import type { Tx } from "../../shared/db/prisma.js";
import type {
  AssessmentType,
  ContractStatus,
  PlacementRequestStatus,
} from "../../generated/prisma/client.js";

export function searchParentsByPhone(tx: Tx, phone: string) {
  return tx.parent.findMany({ where: { phone: { contains: phone } } });
}

export function findParentByPhone(tx: Tx, phone: string) {
  return tx.parent.findUnique({ where: { phone } });
}

export function createStudent(
  tx: Tx,
  data: { fullName: string; school?: string; grade?: string },
) {
  return tx.student.create({ data });
}

export function findStudentById(tx: Tx, id: string) {
  return tx.student.findUnique({ where: { id } });
}

export function linkParentStudent(tx: Tx, parentId: string, studentId: string) {
  return tx.parentStudent.create({ data: { parentId, studentId } });
}

export function createAssessment(
  tx: Tx,
  data: {
    studentId: string;
    contractId?: string;
    type: AssessmentType;
    takenOn: Date;
    totalPercent: string;
  },
) {
  return tx.assessment.create({ data });
}

export function createContract(
  tx: Tx,
  data: {
    studentId: string;
    programId: string;
    price: string;
    totalVisits: number;
    remainingVisits: number;
    leavesLeft: number;
    rulesAckAt: Date;
  },
) {
  return tx.contract.create({ data });
}

export function findContractById(tx: Tx, id: string) {
  return tx.contract.findUnique({ where: { id } });
}

// FOR UPDATE: тоолуур/төлөвт нөлөөлөх үйлдлийн өмнө гэрээг түгжинэ (CLAUDE.md 6.3, ADR-009).
export async function lockContractForUpdate(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contracts WHERE id = ${id}::uuid FOR UPDATE
  `;
  return rows[0];
}

// tx нь аль хэдийн транзакц дотор байгаа тул дараалсан дуудлага хангалттай
// (tx.$transaction гэж дахин нээх шаардлагагүй, TransactionClient-д ч байхгүй).
export async function replacePlanItems(
  tx: Tx,
  contractId: string,
  items: { position: number; topic: string }[],
) {
  await tx.planItem.deleteMany({ where: { contractId } });
  if (items.length > 0) {
    await tx.planItem.createMany({ data: items.map((item) => ({ contractId, ...item })) });
  }
}

export function updateContractStatus(tx: Tx, id: string, status: ContractStatus) {
  return tx.contract.update({ where: { id }, data: { status } });
}

export function findActivePause(tx: Tx, contractId: string) {
  return tx.contractPause.findFirst({ where: { contractId, endedOn: null } });
}

export function createContractPause(
  tx: Tx,
  data: { contractId: string; startedOn: Date; holdSeat: boolean; reason: string; pausedBy: string },
) {
  return tx.contractPause.create({ data });
}

export function closePause(tx: Tx, id: string, endedOn: Date, resumedBy: string) {
  return tx.contractPause.update({ where: { id }, data: { endedOn, resumedBy } });
}

export function createPlacementRequest(
  tx: Tx,
  data: {
    studentName: string;
    school?: string;
    grade?: string;
    phone: string;
    programInterest?: string;
    branchId?: string;
  },
) {
  return tx.placementRequest.create({ data });
}

export function listPlacementRequests(tx: Tx, status?: PlacementRequestStatus) {
  return tx.placementRequest.findMany({
    where: status ? { status } : undefined,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function updatePlacementRequest(
  tx: Tx,
  id: string,
  data: { status: PlacementRequestStatus; note?: string },
) {
  return tx.placementRequest.update({ where: { id }, data });
}
