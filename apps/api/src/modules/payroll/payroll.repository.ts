import type { Tx } from "../../shared/db/prisma.js";
import type { LedgerType } from "../../generated/prisma/client.js";

// ФШ-10: тухайн өдрийн хамгийн ойрын хүчинтэй үнэлгээ (ADR-013).
export function findEffectiveRate(tx: Tx, teacherId: string, onDate: Date) {
  return tx.teacherRate.findFirst({
    where: { teacherId, effectiveFrom: { lte: onDate } },
    orderBy: { effectiveFrom: "desc" },
  });
}

export function createLedgerEntry(
  tx: Tx,
  data: {
    teacherId: string;
    type: LedgerType;
    amount: string;
    lessonId?: string;
    attendanceId?: string;
    rateUsed?: string;
    note?: string;
    createdBy: string;
  },
) {
  return tx.ledgerEntry.create({ data });
}

// ADR-017: ирцийн мөр бүрт нэг EARNING.
export function findEarningByAttendance(tx: Tx, attendanceId: string) {
  return tx.ledgerEntry.findFirst({ where: { attendanceId, type: "EARNING" } });
}

// Ирцийн мөрийн одоогийн цалин = EARNING + бүх ADJUSTMENT-ийн нийлбэр.
export async function sumByAttendance(tx: Tx, attendanceId: string) {
  const result = await tx.ledgerEntry.aggregate({
    where: { attendanceId },
    _sum: { amount: true },
  });
  return result._sum.amount;
}

export async function getTeacherBalance(tx: Tx, teacherId: string): Promise<string> {
  const result = await tx.ledgerEntry.aggregate({
    where: { teacherId },
    _sum: { amount: true },
  });
  return (result._sum.amount ?? "0").toString();
}
