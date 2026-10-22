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

// ФШ-53: цагийн үнэлгээ × тооцогдох сурагчийн тоо × хугацаа (цагаар).
// ФБШ-02: Decimal-аар, JavaScript number-оор мөнгө тооцохгүй.
// attendance.service нэг транзакц дотроос дуудна (CLAUDE.md 6.3).
export async function recordEarningInTx(
  tx: Tx,
  params: {
    lessonId: string;
    teacherId: string;
    lessonDate: Date;
    durationMin: number;
    countedStudents: number;
    createdBy: string;
  },
) {
  const rate = await repo.findEffectiveRate(tx, params.teacherId, params.lessonDate);
  if (!rate) rateNotConfigured(params.teacherId);

  const hours = new Prisma.Decimal(params.durationMin).div(60);
  const amount = rate.hourlyRate.times(params.countedStudents).times(hours);

  return repo.createLedgerEntry(tx, {
    teacherId: params.teacherId,
    type: LedgerType.EARNING,
    amount: amount.toFixed(2),
    lessonId: params.lessonId,
    rateUsed: rate.hourlyRate.toFixed(2),
    createdBy: params.createdBy,
  });
}

// ФШ-34, ADR-010: олголтын дараах засварыг ADJUSTMENT мөрөөр (анхны EARNING-ийг
// хэзээ ч засахгүй). amount тэмдэгтэй (нэмэгдэх эсвэл хасагдах зөрүү).
export function recordAdjustmentInTx(
  tx: Tx,
  params: {
    teacherId: string;
    lessonId: string;
    amount: Prisma.Decimal;
    note: string;
    createdBy: string;
  },
) {
  return repo.createLedgerEntry(tx, {
    teacherId: params.teacherId,
    type: LedgerType.ADJUSTMENT,
    amount: params.amount.toFixed(2),
    lessonId: params.lessonId,
    note: params.note,
    createdBy: params.createdBy,
  });
}

export function getTeacherBalance(teacherId: string) {
  return repo.getTeacherBalance(prisma, teacherId);
}
