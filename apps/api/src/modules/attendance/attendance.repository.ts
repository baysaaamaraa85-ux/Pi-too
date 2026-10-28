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
    take: 100,
  });
}

// Ирээдүйн хичээлд өгсөн чөлөөний хүсэлтүүд (UI "Чөлөө хүссэн" гэж тэмдэглэнэ).
export function findUpcomingLeaveRequestsForStudent(tx: Tx, studentId: string, now: Date) {
  return tx.leaveRequest.findMany({
    where: { contract: { studentId }, lesson: { startsAt: { gt: now } } },
    select: { lessonId: true, contractId: true },
  });
}
