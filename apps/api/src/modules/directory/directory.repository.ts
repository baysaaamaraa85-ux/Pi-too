import type { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../../shared/db/prisma.js";

// Админы жагсаалтын унших асуулгууд (зөвхөн унших). Бичих үйлдлүүд өөрийн модулийн
// service-ээр (auth, enrollment, catalog) дамжина.

const activeClassWhere = { isActive: true } satisfies Prisma.ClassWhereInput;

function teacherWhere(f: {
  search?: string;
  branchId?: string;
  status?: "active" | "inactive";
}): Prisma.TeacherWhereInput {
  return {
    ...(f.search
      ? {
          OR: [
            { fullName: { contains: f.search, mode: "insensitive" } },
            { user: { phone: { contains: f.search } } },
          ],
        }
      : {}),
    ...(f.branchId ? { classes: { some: { branchId: f.branchId, ...activeClassWhere } } } : {}),
    ...(f.status ? { user: { isActive: f.status === "active" } } : {}),
  };
}

export async function listTeachers(
  tx: Tx,
  f: { search?: string; branchId?: string; status?: "active" | "inactive"; page: number; limit: number },
) {
  const where = teacherWhere(f);
  const [items, total] = await Promise.all([
    tx.teacher.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: {
        user: true,
        classes: { where: activeClassWhere, include: { branch: true } },
      },
    }),
    tx.teacher.count({ where }),
  ]);
  return { items, total };
}

export function findTeacher(tx: Tx, id: string) {
  return tx.teacher.findUnique({
    where: { userId: id },
    include: {
      user: true,
      classes: {
        where: activeClassWhere,
        include: {
          branch: true,
          _count: { select: { enrollments: { where: { toDate: null } } } },
        },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
    },
  });
}

function parentWhere(f: {
  search?: string;
  branchId?: string;
  status?: "active" | "inactive";
}): Prisma.ParentWhereInput {
  return {
    ...(f.search
      ? {
          OR: [
            { fullName: { contains: f.search, mode: "insensitive" } },
            { phone: { contains: f.search } },
            { parentStudents: { some: { student: { fullName: { contains: f.search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
    ...(f.branchId
      ? {
          parentStudents: {
            some: {
              student: {
                contracts: {
                  some: { enrollments: { some: { toDate: null, class: { branchId: f.branchId } } } },
                },
              },
            },
          },
        }
      : {}),
    ...(f.status ? { user: { isActive: f.status === "active" } } : {}),
  };
}

export async function listParents(
  tx: Tx,
  f: { search?: string; branchId?: string; status?: "active" | "inactive"; page: number; limit: number },
) {
  const where = parentWhere(f);
  const [items, total] = await Promise.all([
    tx.parent.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: { user: true, parentStudents: { include: { student: true } } },
    }),
    tx.parent.count({ where }),
  ]);
  return { items, total };
}

const studentContractInclude = {
  _count: { select: { meetings: true } },
  program: true,
  enrollments: {
    where: { toDate: null },
    include: { class: { include: { branch: true, teacher: true } } },
  },
} satisfies Prisma.ContractInclude;

export function findParent(tx: Tx, id: string) {
  return tx.parent.findUnique({
    where: { userId: id },
    include: {
      user: true,
      parentStudents: {
        include: {
          student: { include: { contracts: { include: studentContractInclude, orderBy: { createdAt: "desc" } } } },
        },
      },
    },
  });
}

function studentWhere(f: {
  search?: string;
  branchId?: string;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "NONE";
}): Prisma.StudentWhereInput {
  return {
    ...(f.search
      ? {
          OR: [
            { fullName: { contains: f.search, mode: "insensitive" } },
            { user: { phone: { contains: f.search } } },
            { parentStudents: { some: { parent: { phone: { contains: f.search } } } } },
          ],
        }
      : {}),
    ...(f.branchId
      ? {
          contracts: {
            some: { enrollments: { some: { toDate: null, class: { branchId: f.branchId } } } },
          },
        }
      : {}),
    ...(f.status === "NONE"
      ? { contracts: { none: {} } }
      : f.status
        ? { contracts: { some: { status: f.status } } }
        : {}),
  };
}

export async function listStudents(
  tx: Tx,
  f: {
    search?: string;
    branchId?: string;
    status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "NONE";
    page: number;
    limit: number;
  },
) {
  const where = studentWhere(f);
  const [items, total] = await Promise.all([
    tx.student.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { fullName: "asc" }],
      skip: (f.page - 1) * f.limit,
      take: f.limit,
      include: {
        user: true,
        parentStudents: { include: { parent: true } },
        contracts: { include: studentContractInclude, orderBy: { createdAt: "desc" } },
      },
    }),
    tx.student.count({ where }),
  ]);
  return { items, total };
}

export function findStudent(tx: Tx, id: string) {
  return tx.student.findUnique({
    where: { id },
    include: {
      user: true,
      parentStudents: { include: { parent: { include: { user: true } } } },
      contracts: { include: studentContractInclude, orderBy: { createdAt: "desc" } },
      assessments: { orderBy: { takenOn: "desc" } },
    },
  });
}

export function findRecentAttendanceForStudent(tx: Tx, studentId: string, take: number) {
  return tx.attendance.findMany({
    where: { contract: { studentId } },
    orderBy: { lesson: { startsAt: "desc" } },
    take,
    include: { lesson: { include: { class: { include: { branch: true } } } } },
  });
}

export function updateUserContact(tx: Tx, userId: string, data: { phone?: string; email?: string | null }) {
  return tx.user.update({ where: { id: userId }, data });
}

export function updateTeacherName(tx: Tx, userId: string, fullName: string) {
  return tx.teacher.update({ where: { userId }, data: { fullName } });
}

export function updateParentProfile(tx: Tx, userId: string, data: { fullName?: string; phone?: string }) {
  return tx.parent.update({ where: { userId }, data });
}

export function updateStudentProfile(
  tx: Tx,
  id: string,
  data: { fullName?: string; school?: string | null; grade?: string | null },
) {
  return tx.student.update({ where: { id }, data });
}

// ФШ-11: тохиргооны шидтэний алхам бүрийн өгөгдлийн тоо.
export async function countSetupEntities(tx: Tx) {
  const [branches, programs, teachers, classes, students] = await Promise.all([
    tx.branch.count(),
    tx.program.count(),
    tx.teacher.count(),
    tx.class.count({ where: { isActive: true } }),
    tx.student.count(),
  ]);
  return { branches, programs, teachers, classes, students };
}

export function updateTeacherPublicProfile(
  tx: Tx,
  userId: string,
  data: { specialties?: string[]; photoUrl?: string | null },
) {
  return tx.teacher.update({ where: { userId }, data });
}

// ФШ-78: нийтийн сайтад зөвхөн идэвхтэй багш. Утас, имэйл, үнэлгээ, цалин орохгүй.
export function listPublicTeachers(tx: Tx) {
  return tx.teacher.findMany({
    where: { user: { isActive: true } },
    select: {
      userId: true,
      fullName: true,
      specialties: true,
      photoUrl: true,
      classes: { where: { isActive: true }, select: { branch: { select: { name: true } } } },
    },
    orderBy: { fullName: "asc" },
  });
}
