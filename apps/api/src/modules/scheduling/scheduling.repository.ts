import type { Tx } from "../../shared/db/prisma.js";

export function createClass(
  tx: Tx,
  data: {
    teacherId: string;
    branchId: string;
    weekday: number;
    startTime: string;
    durationMin: number;
    capacity: number;
  },
) {
  return tx.class.create({ data });
}

export function findClassById(tx: Tx, id: string) {
  return tx.class.findUnique({ where: { id } });
}

export function listClasses(
  tx: Tx,
  filters: { branchId?: string; teacherId?: string; isActive?: boolean; weekday?: number },
) {
  return tx.class.findMany({
    where: {
      branchId: filters.branchId,
      teacherId: filters.teacherId,
      isActive: filters.isActive,
      weekday: filters.weekday,
    },
    include: { branch: true, teacher: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export function countActiveEnrollments(tx: Tx, classId: string) {
  return tx.enrollment.count({ where: { classId, toDate: null } });
}

export function createEnrollment(
  tx: Tx,
  data: { contractId: string; classId: string; fromDate: Date },
) {
  return tx.enrollment.create({ data });
}

export function findActiveEnrollmentsByContract(tx: Tx, contractId: string) {
  return tx.enrollment.findMany({ where: { contractId, toDate: null } });
}

export function closeActiveEnrollmentsForContract(tx: Tx, contractId: string, toDate: Date) {
  return tx.enrollment.updateMany({
    where: { contractId, toDate: null },
    data: { toDate },
  });
}

export function findActiveEnrollmentForContractAndClass(
  tx: Tx,
  contractId: string,
  classId: string,
) {
  return tx.enrollment.findFirst({ where: { contractId, classId, toDate: null } });
}

// Эзэмшлийн шалгалтад (enrollment модуль): гэрээний идэвхтэй бүртгэлүүдийн
// ангийг (ба багшийг) авна.
export function findActiveEnrollmentsWithClass(tx: Tx, contractId: string) {
  return tx.enrollment.findMany({
    where: { contractId, toDate: null },
    include: { class: true },
  });
}

export function listActiveClasses(tx: Tx) {
  return tx.class.findMany({ where: { isActive: true } });
}

export function createLessonsSkipDuplicates(
  tx: Tx,
  data: {
    classId: string;
    teacherId: string;
    startsAt: Date;
    endsAt: Date;
    originalStartsAt: Date;
  }[],
) {
  // ADR-011: UNIQUE(class_id, original_starts_at) тул worker-ийн давтан
  // ажиллуулалт давхардахгүй.
  return tx.lesson.createMany({ data, skipDuplicates: true });
}

export function findLessonById(tx: Tx, id: string) {
  return tx.lesson.findUnique({ where: { id } });
}

export function listLessonsInRange(
  tx: Tx,
  filters: { from: Date; to: Date; teacherId?: string; classIds?: string[] },
) {
  return tx.lesson.findMany({
    where: {
      startsAt: { gte: filters.from, lt: filters.to },
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      ...(filters.classIds ? { classId: { in: filters.classIds } } : {}),
    },
    orderBy: { startsAt: "asc" },
  });
}

export function updateLessonStatus(
  tx: Tx,
  id: string,
  data: { status: "CANCELLED" | "RESCHEDULED"; startsAt?: Date; endsAt?: Date },
) {
  return tx.lesson.update({ where: { id }, data });
}

// Хичээл цуцлагдах/шилжихэд мэдэгдэх боломжит хүмүүсийг сурагч тус бүрээр нь
// олно: сурагчийн өөрийн данс (байвал) ба эцэг эхүүд. Хэнд явуулахыг service
// шийднэ (D-97), repository зөвхөн уншина.
// Зөвхөн уншиж буй, бизнесийн дүрэм давтагдахгүй query тул enrollment
// модулийн хүснэгтүүдийг энд шууд уншихад хориогүй (CLAUDE.md 6.2-ийн
// "repository шууд дуудахгүй" дүрэм нь бусад МОДУЛИЙН service/repository
// файлыг импортлохыг хориглоно, Prisma хүснэгт уншихыг биш).
export interface NotificationTarget {
  studentUserId: string | null;
  parentIds: string[];
}

export async function findNotificationTargetsForClass(
  tx: Tx,
  classId: string,
): Promise<NotificationTarget[]> {
  const enrollments = await tx.enrollment.findMany({
    where: { classId, toDate: null },
    select: { contractId: true },
  });
  const contractIds = enrollments.map((e) => e.contractId);
  if (contractIds.length === 0) return [];

  const contracts = await tx.contract.findMany({
    where: { id: { in: contractIds } },
    select: { studentId: true },
  });
  const studentIds = [...new Set(contracts.map((c) => c.studentId))];
  if (studentIds.length === 0) return [];

  const [students, parentLinks] = await Promise.all([
    tx.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, userId: true } }),
    tx.parentStudent.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, parentId: true },
    }),
  ]);

  return students.map((s) => ({
    studentUserId: s.userId,
    parentIds: parentLinks.filter((p) => p.studentId === s.id).map((p) => p.parentId),
  }));
}

// GET /lessons-ийн эцэг эх/сурагч шүүлтэд (эрхийн матриц, 6.1): уншилтын
// JOIN, бизнесийн шийдвэргүй тул дээрхтэй адил шалтгаанаар шууд.
export async function findContractIdsForParentUser(tx: Tx, parentUserId: string) {
  const links = await tx.parentStudent.findMany({
    where: { parentId: parentUserId },
    select: { studentId: true },
  });
  const studentIds = links.map((l) => l.studentId);
  if (studentIds.length === 0) return [];
  const contracts = await tx.contract.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true },
  });
  return contracts.map((c) => c.id);
}

export async function findContractIdsForStudentUser(tx: Tx, studentUserId: string) {
  const student = await tx.student.findUnique({ where: { userId: studentUserId } });
  if (!student) return [];
  const contracts = await tx.contract.findMany({
    where: { studentId: student.id },
    select: { id: true },
  });
  return contracts.map((c) => c.id);
}

export async function findClassIdsForContracts(tx: Tx, contractIds: string[]) {
  const enrollments = await tx.enrollment.findMany({
    where: { contractId: { in: contractIds }, toDate: null },
    select: { classId: true },
  });
  return [...new Set(enrollments.map((e) => e.classId))];
}

export function deactivateClass(tx: Tx, id: string) {
  return tx.class.update({ where: { id }, data: { isActive: false } });
}

// Анги устгахад ирээдүйн хичээлүүдээс түүхгүй (ирц, чөлөөний хүсэлт, цалингийн
// бичилтгүй) нь бүрэн устна. Түүхтэй нь цуцлагдсан төлөвт үлдэнэ.
export function deleteFutureLessonsWithoutHistory(tx: Tx, classId: string, now: Date) {
  return tx.lesson.deleteMany({
    where: {
      classId,
      startsAt: { gt: now },
      attendance: { none: {} },
      leaveRequests: { none: {} },
      ledgerEntries: { none: {} },
    },
  });
}

export function cancelRemainingFutureLessons(tx: Tx, classId: string, now: Date) {
  return tx.lesson.updateMany({
    where: { classId, startsAt: { gt: now }, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });
}

// ФШ-71: нэг бүртгэлийг (сурагч, анги) хаана.
export function closeEnrollment(tx: Tx, enrollmentId: string, toDate: Date) {
  return tx.enrollment.update({ where: { id: enrollmentId }, data: { toDate } });
}

// D-69: идэвхтэй ангиуд бүртгэлтэй сурагчийн тоотой (долоо хоногийн хуваарь).
export function listClassesWithCounts(tx: Tx, filters: { teacherId?: string }) {
  return tx.class.findMany({
    where: { isActive: true, teacherId: filters.teacherId },
    include: { branch: true, _count: { select: { enrollments: { where: { toDate: null } } } } },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

// Ангийн одоогийн сурагчид (идэвхтэй бүртгэл).
export function listActiveRoster(tx: Tx, classId: string) {
  return tx.enrollment.findMany({
    where: { classId, toDate: null },
    include: {
      contract: {
        include: {
          student: true,
          program: true,
          enrollments: { where: { toDate: null }, select: { classId: true } },
        },
      },
    },
    orderBy: { contract: { student: { fullName: "asc" } } },
  });
}

export function findClassWithBranch(tx: Tx, id: string) {
  return tx.class.findUnique({ where: { id }, include: { branch: true } });
}
