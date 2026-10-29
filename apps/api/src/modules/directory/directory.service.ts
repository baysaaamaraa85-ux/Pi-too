import { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { createUser } from "../auth/auth.service.js";
import { getTeacherBalance } from "../payroll/payroll.service.js";
import { searchParentsByPhone } from "../enrollment/enrollment.service.js";
import * as repo from "./directory.repository.js";

type StudentRow = NonNullable<Awaited<ReturnType<typeof repo.findStudent>>>;
type ContractRow = StudentRow["contracts"][number];

function notFound(what: string): never {
  throw new DomainError({
    code: "not-found",
    status: 404,
    title: `${what} олдсонгүй`,
    detail: `Заасан ${what.toLowerCase()} бүртгэлгүй байна.`,
  });
}

function classLabel(cls: ContractRow["enrollments"][number]["class"]) {
  return {
    id: cls.id,
    branchId: cls.branchId,
    branchName: cls.branch.name,
    weekday: cls.weekday,
    startTime: cls.startTime,
    teacherId: cls.teacherId,
    teacherName: cls.teacher.fullName,
  };
}

function contractDto(c: ContractRow) {
  return {
    id: c.id,
    programName: c.program.name,
    price: c.price.toFixed(2),
    status: c.status,
    totalVisits: c.totalVisits,
    remainingVisits: c.remainingVisits,
    leavesLeft: c.leavesLeft,
    freeReviewsLeft: c.freeReviewsLeft,
    createdAt: c.createdAt.toISOString(),
    classes: c.enrollments.map((e) => classLabel(e.class)),
  };
}

// Жагсаалтад харуулах үндсэн гэрээ: идэвхтэй, түүнгүй бол зогссон, эс бөгөөс хамгийн сүүлийнх.
function primaryContract(contracts: ContractRow[]): ContractRow | undefined {
  return (
    contracts.find((c) => c.status === "ACTIVE") ??
    contracts.find((c) => c.status === "PAUSED") ??
    contracts[0]
  );
}

// ---- Багш нар ----

export async function listTeachers(q: Parameters<typeof repo.listTeachers>[1]) {
  const { items, total } = await repo.listTeachers(prisma, q);
  return {
    items: items.map((t) => ({
      id: t.userId,
      fullName: t.fullName,
      phone: t.user.phone,
      email: t.user.email,
      isActive: t.user.isActive,
      mustChangePassword: t.user.mustChangePassword,
      currentRate: t.rates[0]?.hourlyRate.toFixed(2) ?? null,
      activeClasses: t.classes.length,
      branches: [...new Map(t.classes.map((c) => [c.branchId, c.branch.name])).entries()].map(
        ([id, name]) => ({ id, name }),
      ),
    })),
    page: q.page,
    limit: q.limit,
    total,
  };
}

export async function getTeacher(id: string) {
  const t = await repo.findTeacher(prisma, id);
  if (!t) notFound("Багш");
  return {
    id: t.userId,
    fullName: t.fullName,
    phone: t.user.phone,
    email: t.user.email,
    isActive: t.user.isActive,
    mustChangePassword: t.user.mustChangePassword,
    balance: await getTeacherBalance(t.userId),
    rates: t.rates.map((r) => ({
      id: r.id,
      hourlyRate: r.hourlyRate.toFixed(2),
      effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
    })),
    classes: t.classes.map((c) => ({
      id: c.id,
      branchName: c.branch.name,
      weekday: c.weekday,
      startTime: c.startTime,
      capacity: c.capacity,
      students: c._count.enrollments,
    })),
  };
}

export function createTeacher(
  input: { fullName: string; phone: string; email?: string },
  actorId: string,
) {
  return createUser("TEACHER", input.phone, input.fullName, { email: input.email, actorId });
}

async function applyContactUpdate(
  tx: Tx,
  userId: string,
  input: { phone?: string; email?: string | null },
) {
  try {
    await repo.updateUserContact(tx, userId, { phone: input.phone, email: input.email });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError({
        code: "contact-taken",
        status: 409,
        title: "Утас эсвэл имэйл бүртгэлтэй байна",
        detail: "Энэ утас эсвэл имэйлтэй өөр хэрэглэгч бүртгэлтэй байна.",
      });
    }
    throw error;
  }
}

export async function updateTeacher(
  id: string,
  input: { fullName?: string; phone?: string; email?: string | null },
  actorId: string,
) {
  await prisma.$transaction(async (tx) => {
    const t = await repo.findTeacher(tx, id);
    if (!t) notFound("Багш");
    await applyContactUpdate(tx, id, input);
    if (input.fullName) await repo.updateTeacherName(tx, id, input.fullName);
    await writeAudit(tx, {
      entity: "teacher",
      entityId: id,
      action: "UPDATE",
      before: { fullName: t.fullName, phone: t.user.phone, email: t.user.email },
      after: input,
      actorId,
    });
  });
  return getTeacher(id);
}

// ---- Эцэг эхчүүд ----

export async function listParents(q: Parameters<typeof repo.listParents>[1]) {
  const { items, total } = await repo.listParents(prisma, q);
  return {
    items: items.map((p) => ({
      id: p.userId,
      fullName: p.fullName,
      phone: p.phone,
      email: p.user.email,
      isActive: p.user.isActive,
      mustChangePassword: p.user.mustChangePassword,
      children: p.parentStudents.map((ps) => ({ id: ps.studentId, fullName: ps.student.fullName })),
    })),
    page: q.page,
    limit: q.limit,
    total,
  };
}

export async function getParent(id: string) {
  const p = await repo.findParent(prisma, id);
  if (!p) notFound("Эцэг эх");
  return {
    id: p.userId,
    fullName: p.fullName,
    phone: p.phone,
    email: p.user.email,
    isActive: p.user.isActive,
    mustChangePassword: p.user.mustChangePassword,
    children: p.parentStudents.map((ps) => ({
      id: ps.studentId,
      fullName: ps.student.fullName,
      grade: ps.student.grade,
      school: ps.student.school,
      contracts: ps.student.contracts.map(contractDto),
    })),
  };
}

export function createParent(
  input: { fullName: string; phone: string; email?: string },
  actorId: string,
) {
  return createUser("PARENT", input.phone, input.fullName, { email: input.email, actorId });
}

export async function updateParent(
  id: string,
  input: { fullName?: string; phone?: string; email?: string | null },
  actorId: string,
) {
  await prisma.$transaction(async (tx) => {
    const p = await repo.findParent(tx, id);
    if (!p) notFound("Эцэг эх");
    await applyContactUpdate(tx, id, input);
    await repo.updateParentProfile(tx, id, { fullName: input.fullName, phone: input.phone });
    await writeAudit(tx, {
      entity: "parent",
      entityId: id,
      action: "UPDATE",
      before: { fullName: p.fullName, phone: p.phone, email: p.user.email },
      after: input,
      actorId,
    });
  });
  return getParent(id);
}

// ФШ-13: админ ба багш утсаар эцэг эхийг хайна.
export function searchParents(phone: string) {
  return searchParentsByPhone(phone);
}

// ---- Сурагчид ----

export async function listStudents(q: Parameters<typeof repo.listStudents>[1]) {
  const { items, total } = await repo.listStudents(prisma, q);
  return {
    items: items.map((s) => {
      const primary = primaryContract(s.contracts);
      return {
        id: s.id,
        fullName: s.fullName,
        grade: s.grade,
        school: s.school,
        accountId: s.userId,
        accountPhone: s.user?.phone ?? null,
        accountActive: s.user?.isActive ?? null,
        parents: s.parentStudents.map((ps) => ({
          id: ps.parentId,
          fullName: ps.parent.fullName,
          phone: ps.parent.phone,
        })),
        contract: primary ? contractDto(primary) : null,
        contractCount: s.contracts.length,
      };
    }),
    page: q.page,
    limit: q.limit,
    total,
  };
}

export async function getStudent(id: string) {
  const s = await repo.findStudent(prisma, id);
  if (!s) notFound("Сурагч");
  const attendance = await repo.findRecentAttendanceForStudent(prisma, id, 50);
  return {
    id: s.id,
    fullName: s.fullName,
    grade: s.grade,
    school: s.school,
    consentAt: s.consentAt?.toISOString() ?? null,
    accountId: s.userId,
    accountPhone: s.user?.phone ?? null,
    accountActive: s.user?.isActive ?? null,
    parents: s.parentStudents.map((ps) => ({
      id: ps.parentId,
      fullName: ps.parent.fullName,
      phone: ps.parent.phone,
    })),
    contracts: s.contracts.map(contractDto),
    assessments: s.assessments.map((a) => ({
      id: a.id,
      type: a.type,
      takenOn: a.takenOn.toISOString().slice(0, 10),
      totalPercent: a.totalPercent.toFixed(2),
    })),
    attendance: attendance.map((a) => ({
      id: a.id,
      status: a.status,
      startsAt: a.lesson.startsAt.toISOString(),
      branchName: a.lesson.class.branch.name,
    })),
  };
}

export async function updateStudent(
  id: string,
  input: { fullName?: string; school?: string | null; grade?: string | null },
  actorId: string,
) {
  await prisma.$transaction(async (tx) => {
    const s = await repo.findStudent(tx, id);
    if (!s) notFound("Сурагч");
    await repo.updateStudentProfile(tx, id, input);
    await writeAudit(tx, {
      entity: "student",
      entityId: id,
      action: "UPDATE",
      before: { fullName: s.fullName, school: s.school, grade: s.grade },
      after: input,
      actorId,
    });
  });
  return getStudent(id);
}

// ФШ-11: салбар, хөтөлбөр, багш, анги, сурагч гэсэн дараалал. Өмнөх алхмын өгөгдөл
// оруулагдаагүй бол дараагийн алхам идэвхжихгүй (unlocked = false). Дүрмийг энд тооцно,
// frontend зөвхөн харуулна.
export async function getSetupStatus() {
  const counts = await repo.countSetupEntities(prisma);
  const steps = [
    { key: "branches", count: counts.branches },
    { key: "programs", count: counts.programs },
    { key: "teachers", count: counts.teachers },
    { key: "classes", count: counts.classes },
    { key: "students", count: counts.students },
  ];
  return steps.map((step, index) => ({
    ...step,
    done: step.count > 0,
    unlocked: index === 0 || (steps[index - 1]?.count ?? 0) > 0,
  }));
}
