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

// ---- Устгал (зөвхөн түүхгүй бүртгэл). Шийдвэрийг service гаргана, энд зөвхөн асуулга. ----

// Багшийг устгахыг хориглох түүх: Restrict холбоос бүр. Тоо нь 0-ээс их бол DB-ийн FK-д
// бүр ч баригдах тул service урьдчилан шалгаж ойлгомжтой мессеж өгнө.
export async function countTeacherHistory(tx: Tx, id: string) {
  const [classes, lessons, ledger, rates, tasks, notes, meetings, pauses, payments, claims, audits] =
    await Promise.all([
      tx.class.count({ where: { teacherId: id } }),
      tx.lesson.count({ where: { teacherId: id } }),
      tx.ledgerEntry.count({ where: { OR: [{ teacherId: id }, { createdBy: id }] } }),
      tx.contractRate.count({ where: { teacherId: id } }),
      tx.teacherTask.count({ where: { teacherId: id } }),
      tx.lessonNote.count({ where: { authorId: id } }),
      tx.parentMeeting.count({ where: { teacherId: id } }),
      tx.contractPause.count({ where: { OR: [{ pausedBy: id }, { resumedBy: id }] } }),
      tx.payment.count({ where: { createdBy: id } }),
      tx.paymentClaim.count({ where: { resolvedBy: id } }),
      tx.auditLog.count({ where: { actorId: id } }),
    ]);
  return { classes, lessons, ledger, rates, tasks, notes, meetings, pauses, payments, claims, audits };
}

export async function countStudentHistory(tx: Tx, studentId: string, userId: string | null) {
  const [attendance, payments, claims, audits] = await Promise.all([
    tx.attendance.count({ where: { contract: { studentId } } }),
    tx.payment.count({ where: { contract: { studentId } } }),
    tx.paymentClaim.count({ where: { contract: { studentId } } }),
    userId ? tx.auditLog.count({ where: { actorId: userId } }) : Promise.resolve(0),
  ]);
  return { attendance, payments, claims, audits };
}

// Хэрэглэгчийн данс болон түүнд хамаарах түр мөрүүдийг (token, push, outbox) устгана.
export async function deleteUserWithSatellites(tx: Tx, userId: string) {
  await tx.refreshToken.deleteMany({ where: { userId } });
  await tx.passwordReset.deleteMany({ where: { userId } });
  await tx.pushSubscription.deleteMany({ where: { userId } });
  await tx.notificationOutbox.deleteMany({ where: { recipientId: userId } });
  await tx.idempotencyKey.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}

export async function deleteTeacherRecords(tx: Tx, userId: string) {
  // D-102: салбарын ахлагч, хүсэлтийн хариуцагчийн холбоосыг салгана (хүсэлт ба салбар өөрөө үлдэнэ).
  await tx.branch.updateMany({ where: { leadTeacherId: userId }, data: { leadTeacherId: null } });
  await tx.placementRequest.updateMany({ where: { assignedTeacherId: userId }, data: { assignedTeacherId: null } });
  await tx.teacherCategoryStudent.deleteMany({ where: { teacherId: userId } });
  await tx.teacherCategory.deleteMany({ where: { teacherId: userId } });
  await tx.teacherRate.deleteMany({ where: { teacherId: userId } });
  await tx.teacher.delete({ where: { userId } });
  await deleteUserWithSatellites(tx, userId);
}

// Ирц, төлбөргүй сурагчийн гэрээ болон түүнд хамаарах бүх мөрийг дарааллаар нь устгана.
export async function deleteStudentRecords(tx: Tx, studentId: string, userId: string | null) {
  const contracts = await tx.contract.findMany({ where: { studentId }, select: { id: true } });
  const contractIds = contracts.map((c) => c.id);
  const byContract = { contractId: { in: contractIds } };

  await tx.assessmentTopic.deleteMany({ where: { assessment: { studentId } } });
  await tx.assessment.deleteMany({ where: { studentId } });
  await tx.leaveRequest.deleteMany({ where: byContract });
  await tx.planItem.deleteMany({ where: byContract });
  await tx.enrollment.deleteMany({ where: byContract });
  await tx.contractPause.deleteMany({ where: byContract });
  await tx.teacherTask.deleteMany({ where: byContract });
  await tx.lessonNote.deleteMany({ where: byContract });
  await tx.parentMeeting.deleteMany({ where: byContract });
  await tx.contractRate.deleteMany({ where: byContract });
  await tx.contract.deleteMany({ where: { studentId } });
  await tx.teacherCategoryStudent.deleteMany({ where: { studentId } });
  await tx.parentStudent.deleteMany({ where: { studentId } });
  await tx.student.delete({ where: { id: studentId } });
  if (userId) await deleteUserWithSatellites(tx, userId);
  return { contracts: contractIds.length };
}

// ФШ-11: тохиргооны шидтэний алхам бүрийн өгөгдлийн тоо.
export async function countSetupEntities(tx: Tx) {
  const [branches, programs, teachers, classes, students] = await Promise.all([
    tx.branch.count({ where: { isActive: true } }),
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
