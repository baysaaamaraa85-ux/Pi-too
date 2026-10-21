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
  filters: { branchId?: string; teacherId?: string; isActive?: boolean },
) {
  return tx.class.findMany({
    where: {
      branchId: filters.branchId,
      teacherId: filters.teacherId,
      isActive: filters.isActive,
    },
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
