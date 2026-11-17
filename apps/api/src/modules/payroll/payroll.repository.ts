import type { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../../shared/db/prisma.js";
import type { LedgerType } from "../../generated/prisma/client.js";

// D-67: тухайн багшийн тухайн хүүхдэд (гэрээнд) оруулсан, тухайн өдөр хүчинтэй хамгийн сүүлийн үнэлгээ (ADR-013).
export function findEffectiveContractRate(tx: Tx, contractId: string, teacherId: string, onDate: Date) {
  return tx.contractRate.findFirst({
    where: { contractId, teacherId, effectiveFrom: { lte: onDate } },
    orderBy: { effectiveFrom: "desc" },
  });
}

export function findContractDiscount(tx: Tx, contractId: string) {
  return tx.contract.findUnique({ where: { id: contractId }, select: { id: true, siblingDiscountPercent: true } });
}

export function upsertContractRate(
  tx: Tx,
  data: { contractId: string; teacherId: string; hourlyRate: string; effectiveFrom: Date; createdBy: string },
) {
  return tx.contractRate.upsert({
    where: {
      contractId_teacherId_effectiveFrom: {
        contractId: data.contractId,
        teacherId: data.teacherId,
        effectiveFrom: data.effectiveFrom,
      },
    },
    update: { hourlyRate: data.hourlyRate, createdBy: data.createdBy },
    create: data,
  });
}

// Багшийн идэвхтэй гэрээнүүд (сурагч бүр) ба сүүлийн хүчинтэй үнэлгээ.
export async function listTeacherContracts(tx: Tx, teacherId: string) {
  return tx.contract.findMany({
    where: {
      status: { in: ["ACTIVE", "PAUSED"] },
      enrollments: { some: { toDate: null, class: { teacherId } } },
    },
    select: {
      id: true,
      siblingDiscountPercent: true,
      student: { select: { id: true, fullName: true } },
      program: { select: { id: true, name: true, protocolHourlyRate: true } },
      rates: { where: { teacherId }, orderBy: { effectiveFrom: "desc" } },
    },
    orderBy: { student: { fullName: "asc" } },
  });
}

// Захирлын протокол: бүх идэвхтэй (багш, гэрээ) хос.
export function listProtocolPairs(tx: Tx) {
  return tx.enrollment.findMany({
    where: { toDate: null, contract: { status: { in: ["ACTIVE", "PAUSED"] } } },
    select: {
      class: { select: { teacherId: true, teacher: { select: { fullName: true } } } },
      contract: {
        select: {
          id: true,
          siblingDiscountPercent: true,
          student: { select: { fullName: true } },
          program: { select: { id: true, name: true, protocolHourlyRate: true } },
          rates: { orderBy: { effectiveFrom: "desc" } },
        },
      },
    },
  });
}

export function listPrograms(tx: Tx) {
  return tx.program.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, protocolHourlyRate: true } });
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

// ---- D-68: багшийн цалин сурагч (гэрээ) бүрээр ----

export interface DateRange {
  from?: Date;
  to?: Date;
}

function lessonRange(r: DateRange): Prisma.LessonWhereInput {
  return r.from !== undefined || r.to !== undefined ? { startsAt: { gte: r.from, lte: r.to } } : {};
}

// Багш энэ хүүхдийг одоо заадаг (идэвхтэй бүртгэл) эсвэл өмнө нь заасан (ирцтэй) эсэх.
export async function teacherHasContract(tx: Tx, teacherId: string, contractId: string) {
  const [enrolled, taught] = await Promise.all([
    tx.enrollment.findFirst({ where: { contractId, class: { teacherId } }, select: { id: true } }),
    tx.attendance.findFirst({ where: { contractId, lesson: { teacherId } }, select: { id: true } }),
  ]);
  return enrolled !== null || taught !== null;
}

// Багшийн бүх хүүхэд: идэвхтэй бүртгэлтэй эсвэл түүний хичээлд ирцтэй гэрээ.
export function listContractsForTeacher(tx: Tx, teacherId: string) {
  return tx.contract.findMany({
    where: {
      OR: [
        { status: { in: ["ACTIVE", "PAUSED"] }, enrollments: { some: { toDate: null, class: { teacherId } } } },
        { attendance: { some: { lesson: { teacherId } } } },
      ],
    },
    select: {
      id: true,
      status: true,
      price: true,
      totalHours: true,
      siblingDiscountPercent: true,
      student: { select: { id: true, fullName: true } },
      program: { select: { name: true } },
      rates: { where: { teacherId }, orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
    orderBy: { student: { fullName: "asc" } },
  });
}

// Цалинд тооцогдсон төлөвтэй ирцүүд (хичээлийн хугацаатай).
export function listCountedAttendance(
  tx: Tx,
  p: { teacherId: string; contractIds: string[]; statuses: readonly string[]; range: DateRange },
) {
  return tx.attendance.findMany({
    where: {
      contractId: { in: p.contractIds },
      status: { in: p.statuses as never },
      lesson: { teacherId: p.teacherId, ...lessonRange(p.range) },
    },
    select: {
      id: true,
      contractId: true,
      actualStartsAt: true,
      actualEndsAt: true,
      lesson: { select: { startsAt: true, endsAt: true } },
    },
  });
}

// Хугацаанд багшид бодогдсон цалин (EARNING + ADJUSTMENT), хичээлийн огноогоор.
export function listEarningsForContracts(tx: Tx, p: { teacherId: string; contractIds: string[]; range: DateRange }) {
  return tx.ledgerEntry.findMany({
    where: {
      teacherId: p.teacherId,
      type: { in: ["EARNING", "ADJUSTMENT"] },
      attendance: { contractId: { in: p.contractIds } },
      lesson: lessonRange(p.range),
    },
    select: { amount: true, attendance: { select: { contractId: true } } },
  });
}

// Нэг хүүхдийн бүх ирц (бүх төлөв) ба тэдгээрт бодогдсон цалингийн мөрүүд.
export async function listAttendanceEntries(tx: Tx, p: { teacherId: string; contractId: string; range: DateRange }) {
  const rows = await tx.attendance.findMany({
    where: { contractId: p.contractId, lesson: { teacherId: p.teacherId, ...lessonRange(p.range) } },
    include: { lesson: { include: { class: { include: { branch: true } } } } },
    orderBy: { lesson: { startsAt: "desc" } },
  });
  const ledger = await tx.ledgerEntry.findMany({
    where: { teacherId: p.teacherId, attendanceId: { in: rows.map((r) => r.id) }, type: { in: ["EARNING", "ADJUSTMENT"] } },
    select: { attendanceId: true, amount: true, rateUsed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return { rows, ledger };
}

// Нөхөн бодолтод: энэ багшийн энэ хүүхдэд цалинд тооцогдсон бүх ирц.
export function listCountedLessonsForTrueUp(
  tx: Tx,
  p: { teacherId: string; contractId: string; statuses: readonly string[] },
) {
  return tx.attendance.findMany({
    where: { contractId: p.contractId, status: { in: p.statuses as never }, lesson: { teacherId: p.teacherId } },
    select: {
      id: true,
      lessonId: true,
      actualStartsAt: true,
      actualEndsAt: true,
      lesson: { select: { startsAt: true, endsAt: true } },
    },
  });
}

// Энэ гэрээнд цагийн цалин оруулсан бүх багш.
export async function listRateTeachers(tx: Tx, contractId: string) {
  const rows = await tx.contractRate.findMany({ where: { contractId }, select: { teacherId: true }, distinct: ["teacherId"] });
  return rows.map((r) => r.teacherId);
}

// Цагийн цалин нэг утгатай (хэзээ ч засна): хуучин түүхэн мөрүүдийг устгаж, нэгийг үлдээнэ.
export function deleteContractRatesExcept(tx: Tx, p: { contractId: string; teacherId: string; keepFrom: Date }) {
  return tx.contractRate.deleteMany({
    where: { contractId: p.contractId, teacherId: p.teacherId, effectiveFrom: { not: p.keepFrom } },
  });
}

// Сүүлд илгээсэн төлбөрийн сануулга (аудитаас).
export async function latestReminders(tx: Tx, contractIds: string[]) {
  const rows = await tx.auditLog.findMany({
    where: { entity: "contract", action: "PAYMENT_REMINDER", entityId: { in: contractIds } },
    select: { entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, Date>();
  for (const r of rows) if (!map.has(r.entityId)) map.set(r.entityId, r.createdAt);
  return map;
}
