import type { Prisma } from "../../generated/prisma/client.js";
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

export interface LedgerFilters {
  teacherId?: string;
  branchId?: string;
  type?: LedgerType;
  from?: Date;
  to?: Date;
}

// Хугацааны шүүлт: хичээлтэй холбоотой мөр хичээлийн огноогоор, олголт бүртгэсэн огноогоор.
function ledgerWhere(f: LedgerFilters): Prisma.LedgerEntryWhereInput {
  const range = { gte: f.from, lte: f.to };
  const hasRange = f.from !== undefined || f.to !== undefined;
  return {
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.branchId ? { lesson: { class: { branchId: f.branchId } } } : {}),
    ...(hasRange
      ? { OR: [{ lesson: { startsAt: range } }, { lessonId: null, createdAt: range }] }
      : {}),
  };
}

const ledgerInclude = {
  teacher: true,
  lesson: { include: { class: { include: { branch: true } } } },
  attendance: { include: { contract: { include: { student: true } } } },
} satisfies Prisma.LedgerEntryInclude;

export async function listLedger(tx: Tx, f: LedgerFilters, page: number, limit: number) {
  const where = ledgerWhere(f);
  const [items, total] = await Promise.all([
    tx.ledgerEntry.findMany({
      where,
      include: ledgerInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    tx.ledgerEntry.count({ where }),
  ]);
  return { items, total };
}

// Экспортод хуудаслалтгүй бүгд.
export function listLedgerAll(tx: Tx, f: LedgerFilters) {
  return tx.ledgerEntry.findMany({
    where: ledgerWhere(f),
    include: ledgerInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

// Тухайн шүүлтээр төрөл бүрийн нийлбэр (SQL SUM, ФБШ-05).
export async function sumByType(tx: Tx, f: LedgerFilters) {
  const rows = await tx.ledgerEntry.groupBy({
    by: ["type"],
    where: ledgerWhere(f),
    _sum: { amount: true },
  });
  return rows.map((r) => ({ type: r.type, sum: r._sum.amount }));
}

// ФБШ-05: бүх багшийн нийлбэрийг нэг GROUP BY-аар.
export async function sumByTeacherAndType(tx: Tx, f: Pick<LedgerFilters, "from" | "to">) {
  const rows = await tx.ledgerEntry.groupBy({
    by: ["teacherId", "type"],
    where: ledgerWhere(f),
    _sum: { amount: true },
  });
  return rows.map((r) => ({ teacherId: r.teacherId, type: r.type, sum: r._sum.amount }));
}

export function listTeachers(tx: Tx) {
  return tx.teacher.findMany({ include: { user: true }, orderBy: { fullName: "asc" } });
}

export function findTeacher(tx: Tx, id: string) {
  return tx.teacher.findUnique({ where: { userId: id } });
}

// ФШ-55, 3.8.3: нэг багшид зэрэг олголт хийхээс сэргийлэх түгжээ (транзакц дуустал).
export async function lockTeacherPayroll(tx: Tx, teacherId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${teacherId}))`;
}

// ФБШ-31: ирц бөглөгдөөгүй, дууссан, цуцлагдаагүй, сурагчтай хичээл.
export function countUnfilledLessons(tx: Tx, teacherId: string, now: Date) {
  return tx.lesson.count({
    where: {
      teacherId,
      endsAt: { lt: now },
      status: { not: "CANCELLED" },
      attendance: { none: {} },
      class: { enrollments: { some: { toDate: null, contract: { status: "ACTIVE" } } } },
    },
  });
}
