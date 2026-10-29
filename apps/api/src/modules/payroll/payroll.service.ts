import { Prisma, LedgerType } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as repo from "./payroll.repository.js";

function rateNotConfigured(teacherId: string): never {
  throw new DomainError({
    code: "teacher-rate-not-configured",
    status: 409,
    title: "Багшийн үнэлгээ тохируулагдаагүй",
    detail: "Энэ багшид хүчинтэй цагийн үнэлгээ бүртгэгдээгүй байна.",
    extra: { teacherId },
  });
}

// ФШ-53: нэг мөрийн дүн = цагийн үнэлгээ x хугацаа (цагаар). Цалинд тооцогдох сурагч
// бүрд нэг мөр тул хичээлийн мөрүүдийн нийлбэр = үнэлгээ x сурагчийн тоо x хугацаа.
// ФБШ-02: Decimal-аар, JavaScript number-оор мөнгө тооцохгүй.
export function lineAmount(hourlyRate: Prisma.Decimal, durationMin: number): Prisma.Decimal {
  return hourlyRate.times(new Prisma.Decimal(durationMin).div(60));
}

interface AttendanceLine {
  attendanceId: string;
  lessonId: string;
  teacherId: string;
  lessonDate: Date;
  durationMin: number;
  createdBy: string;
}

// ADR-017, ФШ-32: ирцийн мөр цалинд тооцогдох төлөвтэй үүсэхэд нэг EARNING мөр.
// attendance.service нэг транзакц дотроос дуудна (CLAUDE.md 6.3).
export async function recordAttendanceEarningInTx(tx: Tx, params: AttendanceLine) {
  const rate = await repo.findEffectiveRate(tx, params.teacherId, params.lessonDate);
  if (!rate) rateNotConfigured(params.teacherId);

  return repo.createLedgerEntry(tx, {
    teacherId: params.teacherId,
    type: LedgerType.EARNING,
    amount: lineAmount(rate.hourlyRate, params.durationMin).toFixed(2),
    lessonId: params.lessonId,
    attendanceId: params.attendanceId,
    rateUsed: rate.hourlyRate.toFixed(2),
    createdBy: params.createdBy,
  });
}

// ФШ-34, ADR-010, ADR-017: ирц засахад тухайн ирцийн мөрийн цалинг зорилтот дүнд
// (тооцогдох бол үнэлгээ x хугацаа, үгүй бол 0) хүргэх зөрүүг ADJUSTMENT мөрөөр бичнэ.
// Анхны EARNING мөрийг хэзээ ч засахгүй. Үнэлгээ нь анхны мөрөнд тэмдэглэсэн
// rate_used (байхгүй бол хичээлийн өдрийн үнэлгээ). Зөрүү 0 бол юу ч бичихгүй.
export async function settleAttendanceEarningInTx(
  tx: Tx,
  params: AttendanceLine & { counted: boolean; note: string },
) {
  const earning = await repo.findEarningByAttendance(tx, params.attendanceId);
  let hourlyRate = earning?.rateUsed ?? null;
  if (!hourlyRate) {
    const rate = await repo.findEffectiveRate(tx, params.teacherId, params.lessonDate);
    if (!rate) rateNotConfigured(params.teacherId);
    hourlyRate = rate.hourlyRate;
  }

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
