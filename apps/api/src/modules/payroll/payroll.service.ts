import { Prisma, LedgerType, AttendanceStatus } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import * as repo from "./payroll.repository.js";

// ФШ-53, 54: цалинд тооцогдох ирцийн төлөв (CLAUDE.md 6.4). attendance.rules-ийн effectsOf().counted-тай ижил
// байх ёстой: payroll attendance-ыг дуудахгүй тул энд тусад нь, тэнцэж буйг тест шалгана.
export const PAYROLL_COUNTED_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.OVER_LIMIT,
  AttendanceStatus.MAKEUP,
];

// ФШ-53: нэг мөрийн дүн = цагийн үнэлгээ x хугацаа (цагаар). Цалинд тооцогдох сурагч
// бүрд нэг мөр тул хичээлийн мөрүүдийн нийлбэр = үнэлгээ x сурагчийн тоо x хугацаа.
// ФБШ-02: Decimal-аар, JavaScript number-оор мөнгө тооцохгүй.
export function lineAmount(hourlyRate: Prisma.Decimal, durationMin: number): Prisma.Decimal {
  return hourlyRate.times(new Prisma.Decimal(durationMin).div(60));
}

// D-67: ах дүүгийн хөнгөлөлт. Багшийн оруулсан үнэлгээ хөнгөлөлтийн хувиар буурна: 40 000 ₮, 10% -> 36 000 ₮.
export function applyDiscount(hourlyRate: Prisma.Decimal, discountPercent: Prisma.Decimal): Prisma.Decimal {
  return hourlyRate.times(new Prisma.Decimal(100).minus(discountPercent)).div(100).toDecimalPlaces(2);
}

// D-70: ирцийн бодит орсон минут. Багш "цаг нэмэгдсэн" гэж бичсэн бол бодит, үгүй бол хичээлийн төлөвлөсөн цаг.
export function attendanceMinutes(
  a: { actualStartsAt: Date | null; actualEndsAt: Date | null },
  lesson: { startsAt: Date; endsAt: Date },
): number {
  const start = a.actualStartsAt ?? lesson.startsAt;
  const end = a.actualEndsAt ?? lesson.endsAt;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

interface ResolvedRate {
  // Багшийн оруулсан үнэлгээ.
  base: Prisma.Decimal;
  // Хөнгөлөлтийн дараах, цалинд бодогдох үнэлгээ.
  effective: Prisma.Decimal;
}

// D-67: хичээлийн өдөр (багш, хүүхэд) хос дээр хүчинтэй үнэлгээ. Оруулаагүй бол null.
export async function resolveRate(
  tx: Tx,
  p: { contractId: string; teacherId: string; lessonDate: Date },
): Promise<ResolvedRate | null> {
  const rate = await repo.findEffectiveContractRate(tx, p.contractId, p.teacherId, p.lessonDate);
  if (!rate) return null;
  const contract = await repo.findContractDiscount(tx, p.contractId);
  const discount = contract?.siblingDiscountPercent ?? new Prisma.Decimal(0);
  return { base: rate.hourlyRate, effective: applyDiscount(rate.hourlyRate, discount) };
}

interface AttendanceLine {
  attendanceId: string;
  contractId: string;
  lessonId: string;
  teacherId: string;
  lessonDate: Date;
  durationMin: number;
  createdBy: string;
}

// ADR-017, ФШ-32: ирцийн мөр цалинд тооцогдох төлөвтэй үүсэхэд нэг EARNING мөр.
// attendance.service нэг транзакц дотроос дуудна (CLAUDE.md 6.3).
// D-67: багш энэ хүүхдэд үнэлгээгээ оруулаагүй бол 0 ₮ (rate_used = null) мөр бичиж, үнэлгээ оруулсны дараа
// нөхөн бодно (ирц бүртгэхийг хориглохгүй).
export async function recordAttendanceEarningInTx(tx: Tx, params: AttendanceLine) {
  const rate = await resolveRate(tx, params);
  return repo.createLedgerEntry(tx, {
    teacherId: params.teacherId,
    type: LedgerType.EARNING,
    amount: rate ? lineAmount(rate.effective, params.durationMin).toFixed(2) : "0.00",
    lessonId: params.lessonId,
    attendanceId: params.attendanceId,
    rateUsed: rate?.effective.toFixed(2),
    note: rate ? undefined : "Цагийн үнэлгээ оруулаагүй",
    createdBy: params.createdBy,
  });
}

// ФШ-34, ADR-010, ADR-017: ирц засахад (мөн цагийн цалин, хөнгөлөлт өөрчлөгдөхөд) тухайн ирцийн мөрийн цалинг
// зорилтот дүнд (тооцогдох бол ОДООГИЙН цагийн цалин x хугацаа, үгүй бол 0) хүргэх зөрүүг ADJUSTMENT мөрөөр
// бичнэ. Анхны EARNING мөрийг хэзээ ч засахгүй. D-68: цагийн цалин хүүхэд бүрт нэг утгатай, хэзээ ч засагдана,
// тиймээс үргэлж одоогийн утгыг хэрэглэнэ. Цагийн цалин байхгүй бол анхны мөрийн rate_used, түүнгүй бол 0.
// Зөрүү 0 бол юу ч бичихгүй.
export async function settleAttendanceEarningInTx(
  tx: Tx,
  params: AttendanceLine & { counted: boolean; note: string },
) {
  const rate = await resolveRate(tx, params);
  let hourlyRate: Prisma.Decimal | null = rate?.effective ?? null;
  if (!hourlyRate) {
    const earning = await repo.findEarningByAttendance(tx, params.attendanceId);
    hourlyRate = earning?.rateUsed ?? null;
  }
  // Цагийн цалин оруулаагүй хэвээр бол цалин 0, засах зүйлгүй.
  if (!hourlyRate) return null;

  const target = params.counted ? lineAmount(hourlyRate, params.durationMin) : new Prisma.Decimal(0);
  const current = new Prisma.Decimal((await repo.sumByAttendance(tx, params.attendanceId)) ?? 0);
  const delta = target.minus(current);
  if (delta.isZero()) return null;

  return repo.createLedgerEntry(tx, {
    teacherId: params.teacherId,
    type: LedgerType.ADJUSTMENT,
    amount: delta.toFixed(2),
    lessonId: params.lessonId,
    attendanceId: params.attendanceId,
    rateUsed: hourlyRate.toFixed(2),
    note: params.note,
    createdBy: params.createdBy,
  });
}

export function getTeacherBalance(teacherId: string) {
  return repo.getTeacherBalance(prisma, teacherId);
}
