import { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { removeUploadedImage, saveImage } from "../../shared/uploads/image-upload.js";
import type { AuthUser } from "../../shared/rbac/types.js";
import { createUser } from "../auth/auth.service.js";
import { getTeacherBalance } from "../payroll/payroll.service.js";
import { balancesFor, type ContractBalance } from "../../shared/payments/payment-status.js";
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

function contractDto(c: ContractRow, balance?: ContractBalance) {
  return {
    paid: balance?.paid.toFixed(2) ?? null,
    balance: balance?.balance.toFixed(2) ?? null,
    paymentStatus: balance?.status ?? null,
    id: c.id,
    programName: c.program.name,
    price: c.price.toFixed(2),
    // D-67: ах дүүгийн хөнгөлөлт ба хөнгөлөхөөс өмнөх үнэ.
    discountPercent: c.siblingDiscountPercent.toFixed(2),
    listPrice: c.listPrice ? c.listPrice.toFixed(2) : null,
    status: c.status,
    totalHours: c.totalHours.toNumber(),
    remainingHours: c.remainingHours.toNumber(),
    leavesLeft: c.leavesLeft,
    freeReviewsLeft: c.freeReviewsLeft,
    meetingsCount: c._count.meetings,
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
    specialties: t.specialties,
    photoUrl: t.photoUrl,
    balance: await getTeacherBalance(t.userId),
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
  input: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    specialties?: string[];
    photoUrl?: string | null;
  },
  actorId: string,
) {
  await prisma.$transaction(async (tx) => {
    const t = await repo.findTeacher(tx, id);
    if (!t) notFound("Багш");
    await applyContactUpdate(tx, id, input);
    if (input.fullName) await repo.updateTeacherName(tx, id, input.fullName);
    if (input.specialties !== undefined || input.photoUrl !== undefined) {
      await repo.updateTeacherPublicProfile(tx, id, {
        specialties: input.specialties,
        photoUrl: input.photoUrl === "" ? null : input.photoUrl,
      });
    }
    await writeAudit(tx, {
      entity: "teacher",
      entityId: id,
      action: "UPDATE",
      before: {
        fullName: t.fullName,
        phone: t.user.phone,
        email: t.user.email,
        specialties: t.specialties,
        photoUrl: t.photoUrl,
      },
      after: input,
      actorId,
    });
  });
  return getTeacher(id);
}

// D-69: багш өөрийн нийтийн сайтад харагдах заах чиглэлээ (мэргэшил) өөрөө засна. Админ хэнийх ч.
export async function updateTeacherSpecialties(actor: AuthUser, id: string, specialties: string[]) {
  if (actor.role !== "ADMIN" && actor.id !== id) {
    throw new DomainError({
      code: "forbidden",
      status: 403,
      title: "Хандах эрхгүй",
      detail: "Та зөвхөн өөрийн профайлыг засна.",
    });
  }
  await prisma.$transaction(async (tx) => {
    const t = await repo.findTeacher(tx, id);
    if (!t) notFound("Багш");
    await repo.updateTeacherPublicProfile(tx, id, { specialties });
    await writeAudit(tx, {
      entity: "teacher",
      entityId: id,
      action: "UPDATE",
      before: { specialties: t.specialties },
      after: { specialties },
      actorId: actor.id,
    });
  });
  return { specialties };
}

// ФШ-78: багшийн зураг. Админ хэнийх ч, багш зөвхөн өөрийнхийг (BOLA, ADR-008).
export async function setTeacherPhoto(id: string, image: Buffer | null, actor: AuthUser) {
  if (actor.role !== "ADMIN" && actor.id !== id) {
    throw new DomainError({
      code: "forbidden",
      status: 403,
      title: "Хандах эрхгүй",
      detail: "Та зөвхөн өөрийн профайлын зургийг солих боломжтой.",
    });
  }
  const photoUrl = await saveImage("teachers", image);
  try {
    const before = await prisma.$transaction(async (tx) => {
      const t = await repo.findTeacher(tx, id);
      if (!t) notFound("Багш");
      await repo.updateTeacherPublicProfile(tx, id, { photoUrl });
      await writeAudit(tx, {
        entity: "teacher",
        entityId: id,
        action: "UPDATE",
        before: { photoUrl: t.photoUrl },
        after: { photoUrl },
        actorId: actor.id,
      });
      return t.photoUrl;
    });
    await removeUploadedImage(before);
  } catch (err) {
    await removeUploadedImage(photoUrl);
    throw err;
  }
  return { photoUrl };
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
      contracts: ps.student.contracts.map((c) => contractDto(c)),
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
  const balances = await balancesFor(prisma, items.flatMap((s) => s.contracts));
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
        contract: primary ? contractDto(primary, balances.get(primary.id)) : null,
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
  const detailBalances = await balancesFor(prisma, s.contracts);
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
    contracts: s.contracts.map((c) => contractDto(c, detailBalances.get(c.id))),
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

// ---- Нийтийн сайт (ФШ-78): нэвтрэлтгүй, зөвхөн нийтэд харагдах мэдээлэл ----

export async function listPublicTeachers() {
  const rows = await repo.listPublicTeachers(prisma);
  return rows.map((t) => ({
    id: t.userId,
    fullName: t.fullName,
    specialties: t.specialties,
    photoUrl: t.photoUrl,
    branches: [...new Set(t.classes.map((c) => c.branch.name))].sort((a, b) => a.localeCompare(b)),
  }));
}
