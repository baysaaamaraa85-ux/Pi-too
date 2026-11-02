import type { Tx } from "../../shared/db/prisma.js";
import type { AttendanceStatus, ContractStatus } from "../../generated/prisma/client.js";

export function findLessonById(tx: Tx, id: string) {
  return tx.lesson.findUnique({ where: { id } });
}

// ФШ-27, 73, 37: ирцийн дэлгэц. Түр зогсоосон гэрээ орохгүй; дууссан гэрээ
// зөвхөн давтлагын эрхтэй бол харагдана (ФШ-37-ийн "Үнэгүй давтлага-аас
// бусад ирц бүртгэгдэхгүй" дүрмийг жагсаалтын түвшинд ч баримтална).
export function findActiveEnrollmentsForClass(tx: Tx, classId: string) {
  return tx.enrollment.findMany({
    where: {
      classId,
      toDate: null,
      contract: {
        OR: [{ status: "ACTIVE" }, { status: "COMPLETED", freeReviewsLeft: { gt: 0 } }],
      },
    },
    include: { contract: true },
  });
}

// ADR-009: тоолууртай мөрийг FOR UPDATE-ээр түгжинэ.
export async function lockContractsForUpdate(tx: Tx, contractIds: string[]) {
  if (contractIds.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM contracts WHERE id = ANY(${contractIds}::uuid[]) FOR UPDATE
  `;
}

export function findContractById(tx: Tx, id: string) {
  return tx.contract.findUnique({ where: { id } });
}

export function updateContractCounters(
  tx: Tx,
  id: string,
  data: {
    remainingVisits?: number;
    leavesLeft?: number;
    freeReviewsLeft?: number;
    status?: ContractStatus;
  },
) {
  return tx.contract.update({ where: { id }, data });
}

export function findAttendance(tx: Tx, lessonId: string, contractId: string) {
  return tx.attendance.findUnique({ where: { lessonId_contractId: { lessonId, contractId } } });
}

export function createAttendance(
  tx: Tx,
  data: {
    lessonId: string;
    contractId: string;
    marked: boolean;
    status: AttendanceStatus;
    isMakeup?: boolean;
    updatedBy: string;
  },
) {
  return tx.attendance.create({ data });
}

export function updateAttendance(
  tx: Tx,
  id: string,
  data: { marked?: boolean; status?: AttendanceStatus; updatedBy: string },
) {
  return tx.attendance.update({ where: { id }, data });
}

export function findAttendanceById(tx: Tx, id: string) {
  return tx.attendance.findUnique({
    where: { id },
    include: { lesson: true, contract: true },
  });
}

export function findLeaveRequest(tx: Tx, contractId: string, lessonId: string) {
  return tx.leaveRequest.findUnique({
    where: { contractId_lessonId: { contractId, lessonId } },
  });
}

export function createLeaveRequest(
  tx: Tx,
  data: { contractId: string; lessonId: string; requestedBy: string },
) {
  return tx.leaveRequest.create({ data });
}

export function createTeacherTask(
  tx: Tx,
  data: { teacherId: string; type: "EXAM" | "MEETING"; contractId: string; dueOn: Date },
) {
  return tx.teacherTask.create({ data });
}

export function countMakeupsForContract(tx: Tx, contractId: string) {
  return tx.attendance.count({ where: { contractId, isMakeup: true } });
}

export function findAuditHistory(tx: Tx, entity: string, entityId: string) {
  return tx.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: "desc" },
  });
}

// Порталын "Миний ирц": сурагчийн сүүлийн ирцүүд (хамгийн шинэ нь эхэнд).
export function findAttendanceForStudent(tx: Tx, studentId: string) {
  return tx.attendance.findMany({
    where: { contract: { studentId } },
    include: { lesson: true, contract: { include: { program: true } } },
    orderBy: { lesson: { startsAt: "desc" } },
    // ФШ-67: дууссан багц бүрийн ирц (багц тус бүр ~25-50 мөр) таслагдахгүй байх нөөцтэй хязгаар.
    take: 1000,
  });
}

// Ирээдүйн хичээлд өгсөн чөлөөний хүсэлтүүд (UI "Чөлөө хүссэн" гэж тэмдэглэнэ).
export function findUpcomingLeaveRequestsForStudent(tx: Tx, studentId: string, now: Date) {
  return tx.leaveRequest.findMany({
    where: { contract: { studentId }, lesson: { startsAt: { gt: now } } },
    select: { lessonId: true, contractId: true },
  });
}

// Ирцийн дэлгэц: хичээл, анги, салбар, багш.
export function findLessonWithContext(tx: Tx, id: string) {
  return tx.lesson.findUnique({
    where: { id },
    include: { class: { include: { branch: true } }, teacher: true },
  });
}

export function findAttendanceByLesson(tx: Tx, lessonId: string) {
  return tx.attendance.findMany({
    where: { lessonId },
    include: { contract: { include: { student: true, program: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function findLeaveRequestsByLesson(tx: Tx, lessonId: string) {
  return tx.leaveRequest.findMany({ where: { lessonId }, select: { contractId: true } });
}

export function findRosterEnrollments(tx: Tx, classId: string, lessonDate: Date) {
  return tx.enrollment.findMany({
    where: {
      classId,
      fromDate: { lte: lessonDate },
      OR: [{ toDate: null }, { toDate: { gte: lessonDate } }],
      contract: {
        OR: [{ status: "ACTIVE" }, { status: "COMPLETED", freeReviewsLeft: { gt: 0 } }],
      },
    },
    include: { contract: { include: { student: true, program: true } } },
  });
}

export function findContractWithStudent(tx: Tx, id: string) {
  return tx.contract.findUnique({
    where: { id },
    include: { student: true, program: true },
  });
}

// ФШ-31: нөхөгдөөгүй чөлөө = Чөлөөтэй ирцийн тоо - Нөхөлтийн тоо.
export async function countExcusedAndMakeups(tx: Tx, contractId: string) {
  const [excused, makeups] = await Promise.all([
    tx.attendance.count({ where: { contractId, status: "EXCUSED" } }),
    tx.attendance.count({ where: { contractId, isMakeup: true } }),
  ]);
  return { excused, makeups };
}

// ФШ-31: багшийн ӨӨР ангийн идэвхтэй гэрээнүүд (нөхөлтийн нэр дэвшигчид).
export function findMakeupCandidateEnrollments(tx: Tx, teacherId: string, excludeClassId: string) {
  return tx.enrollment.findMany({
    where: {
      toDate: null,
      classId: { not: excludeClassId },
      class: { teacherId, isActive: true },
      contract: { status: "ACTIVE" },
    },
    include: { contract: { include: { student: true, program: true } }, class: true },
  });
}

export function findOpenTeacherTask(tx: Tx, contractId: string, type: "EXAM" | "MEETING") {
  return tx.teacherTask.findFirst({ where: { contractId, type, doneAt: null } });
}

export function findAuditHistoryWithActor(tx: Tx, entityId: string) {
  return tx.auditLog.findMany({
    where: { entity: "attendance", entityId },
    orderBy: { createdAt: "asc" },
    include: { actor: true },
  });
}

// Ирцийн жагсаалт: нэг өдрийн (Улаанбаатарын) хичээлүүд, салбар, багш, ирц бүртгэгдсэн тоо.
export function findLessonsForDay(
  tx: Tx,
  range: { from: Date; to: Date },
  filters: { teacherId?: string; branchId?: string },
) {
  return tx.lesson.findMany({
    where: {
      startsAt: { gte: range.from, lt: range.to },
      teacherId: filters.teacherId,
      class: filters.branchId ? { branchId: filters.branchId } : undefined,
    },
    include: {
      class: { include: { branch: true } },
      teacher: true,
      _count: { select: { attendance: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

// ФШ-70: дууссан боловч ирц нэг ч бүртгэгдээгүй хичээлүүд (сүүлийн өдрүүдэд).
export function findEndedLessonsWithoutAttendance(
  tx: Tx,
  teacherId: string,
  range: { from: Date; now: Date },
) {
  return tx.lesson.findMany({
    where: {
      teacherId,
      status: "SCHEDULED",
      startsAt: { gte: range.from },
      endsAt: { lt: range.now },
      attendance: { none: {} },
    },
    include: {
      class: { include: { branch: true } },
      teacher: true,
      _count: { select: { attendance: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}
