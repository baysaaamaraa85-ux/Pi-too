import {
  LedgerType as PrismaLedgerType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js";
import type { LedgerQuery, LedgerRowDto, LedgerSummaryDto } from "@pitoo/contracts";
import { prisma } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { runIdempotent } from "../../shared/idempotency/run-idempotent.js";
import * as repo from "./payroll.repository.js";
import { buildPdf, buildTotal, buildXlsx, type ReportData } from "./payroll.reports.js";

// ФШ-55...59, шинэ шаардлага 1.6: цалингийн журнал харах, олголт хийх, тайлан гаргах.

interface Actor {
  id: string;
  role: Role;
}

const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

// ФБШ-11: ОООО.СС.ӨӨ, Asia/Ulaanbaatar.
function formatDateUb(date: Date): string {
  const local = new Date(date.getTime() + 8 * 3_600_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function rangeOf(q: { from?: string; to?: string }) {
  return {
    from: q.from ? new Date(`${q.from}T00:00:00+08:00`) : undefined,
    to: q.to ? new Date(`${q.to}T23:59:59.999+08:00`) : undefined,
  };
}

function forbidden(): never {
  throw new DomainError({
    code: "forbidden-ledger",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Та зөвхөн өөрийн цалингийн мэдээллийг харна.",
  });
}

type LedgerEntryRow = Awaited<ReturnType<typeof repo.listLedger>>["items"][number];

function mapRow(e: LedgerEntryRow): LedgerRowDto {
  const lesson = e.lesson;
  const durationMin = lesson
    ? Math.round((lesson.endsAt.getTime() - lesson.startsAt.getTime()) / 60_000)
    : null;
  return {
    id: e.id,
    type: e.type,
    date: formatDateUb(lesson ? lesson.startsAt : e.createdAt),
    createdAt: e.createdAt.toISOString(),
    teacherId: e.teacherId,
    teacherName: e.teacher.fullName,
    branchName: lesson?.class.branch.name ?? null,
    classLabel: lesson
      ? `${WEEKDAYS[lesson.class.weekday - 1] ?? ""} ${lesson.class.startTime}`
      : null,
    lessonId: e.lessonId,
    studentName: e.attendance?.contract.student.fullName ?? null,
    attendanceStatus: e.attendance?.status ?? null,
    rateUsed: e.rateUsed ? e.rateUsed.toFixed(2) : null,
    durationHours:
      durationMin !== null && e.type !== PrismaLedgerType.PAYOUT
        ? new Prisma.Decimal(durationMin).div(60).toFixed(2)
        : null,
    amount: e.amount.toFixed(2),
    note: e.note,
  };
}

// Багш зөвхөн өөрийн мөрийг харна (ADR-008), админ шүүлтээр.
function resolveTeacherId(actor: Actor, requested?: string): string | undefined {
  if (actor.role === Role.TEACHER) {
    if (requested && requested !== actor.id) forbidden();
    return actor.id;
  }
  return requested;
}

// Олсон = EARNING + ADJUSTMENT, олгосон = -PAYOUT (сонгосон хугацаагаар), үлдэгдэл бүх хугацаагаар.
async function summaryFor(
  filters: { teacherId?: string; branchId?: string; from?: Date; to?: Date },
): Promise<LedgerSummaryDto> {
  const sums = await repo.sumByType(prisma, filters);
  const get = (t: PrismaLedgerType) =>
    new Prisma.Decimal(sums.find((s) => s.type === t)?.sum ?? 0);
  const earned = get(PrismaLedgerType.EARNING).plus(get(PrismaLedgerType.ADJUSTMENT));
  const paid = get(PrismaLedgerType.PAYOUT).negated();
  const all = await repo.sumByType(prisma, { teacherId: filters.teacherId });
  const balance = all.reduce((acc, s) => acc.plus(s.sum ?? 0), new Prisma.Decimal(0));
  return { earned: earned.toFixed(2), paid: paid.toFixed(2), balance: balance.toFixed(2) };
}

export async function listLedger(actor: Actor, q: LedgerQuery) {
  const teacherId = resolveTeacherId(actor, q.teacherId);
  const { from, to } = rangeOf(q);
  const filters = { teacherId, branchId: q.branchId, from, to };
  const { items, total } = await repo.listLedger(
    prisma,
    { ...filters, type: q.type },
    q.page,
    q.limit,
  );
  return {
    items: items.map(mapRow),
    page: q.page,
    limit: q.limit,
    total,
    summary: await summaryFor(filters),
  };
}

// ФБШ-05: бүх багшийн олсон, олгосон, үлдэгдлийг нэг GROUP BY-аар.
export async function payrollSummary(q: { from?: string; to?: string }) {
  const { from, to } = rangeOf(q);
  const [teachers, period, allTime] = await Promise.all([
    repo.listTeachers(prisma),
    repo.sumByTeacherAndType(prisma, { from, to }),
    repo.sumByTeacherAndType(prisma, {}),
  ]);
  return teachers.map((t) => {
    const pick = (rows: typeof period, type: PrismaLedgerType) =>
      new Prisma.Decimal(
        rows.find((r) => r.teacherId === t.userId && r.type === type)?.sum ?? 0,
      );
    const earned = pick(period, PrismaLedgerType.EARNING).plus(
      pick(period, PrismaLedgerType.ADJUSTMENT),
    );
    const paid = pick(period, PrismaLedgerType.PAYOUT).negated();
    const balance = allTime
      .filter((r) => r.teacherId === t.userId)
      .reduce((acc, r) => acc.plus(r.sum ?? 0), new Prisma.Decimal(0));
    return {
      teacherId: t.userId,
      fullName: t.fullName,
      phone: t.user.phone,
      isActive: t.user.isActive,
      earned: earned.toFixed(2),
      paid: paid.toFixed(2),
      balance: balance.toFixed(2),
    };
  });
}

// ФШ-55, ФБШ-31, 3.8.3: багшид мөнгө олгох. Үлдэгдлээс их, эсвэл ирц бөглөгдөөгүй
// хичээлтэй бол 409 буцаж, админ баталгаажуулсан (confirm) үед л бичигдэнэ.
export function createPayout(
  actor: Actor,
  input: { teacherId: string; amount: string; note?: string; confirm?: boolean },
  idempotencyKey: string,
) {
  return runIdempotent(idempotencyKey, actor.id, async (tx) => {
    const teacher = await repo.findTeacher(tx, input.teacherId);
    if (!teacher) {
      throw new DomainError({
        code: "teacher-not-found",
        status: 404,
        title: "Багш олдсонгүй",
        detail: "Заасан багш бүртгэлгүй байна.",
      });
    }

    // Хоёр админ нэг багшид зэрэг олгоход check-then-act уралдаанаас сэргийлнэ.
    await repo.lockTeacherPayroll(tx, input.teacherId);

    const amount = new Prisma.Decimal(input.amount);
    const balance = new Prisma.Decimal(await repo.getTeacherBalance(tx, input.teacherId));
    const unfilled = await repo.countUnfilledLessons(tx, input.teacherId, new Date());

    if ((amount.gt(balance) || unfilled > 0) && !input.confirm) {
      throw new DomainError({
        code: "payout-needs-confirmation",
        status: 409,
        title: "Олголтыг баталгаажуулна уу",
        detail:
          amount.gt(balance)
            ? `Олголтын дүн үлдэгдлээс (${balance.toFixed(2)}) их байна.`
            : `Энэ багшид ирц бөглөгдөөгүй ${unfilled} хичээл байна.`,
        extra: {
          balance: balance.toFixed(2),
          amount: amount.toFixed(2),
          unfilledLessons: unfilled,
          exceedsBalance: amount.gt(balance),
        },
      });
    }

    const entry = await repo.createLedgerEntry(tx, {
      teacherId: input.teacherId,
      type: PrismaLedgerType.PAYOUT,
      amount: amount.negated().toFixed(2),
      note: input.note,
      createdBy: actor.id,
    });
    const newBalance = balance.minus(amount);
    await writeAudit(tx, {
      entity: "payout",
      entityId: entry.id,
      action: "PAYOUT",
      after: {
        teacherId: input.teacherId,
        amount: amount.toFixed(2),
        balanceBefore: balance.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        unfilledLessons: unfilled,
        confirmed: input.confirm === true,
      },
      reason: input.note,
      actorId: actor.id,
    });
    return {
      id: entry.id,
      teacherId: input.teacherId,
      amount: amount.toFixed(2),
      balance: newBalance.toFixed(2),
    };
  });
}

// ФШ-59: Excel, PDF тайлан. Мөрүүд ба нийлбэр ижил өгөгдлөөс гарна.
export async function exportReport(
  q: { format: "xlsx" | "pdf" } & Pick<LedgerQuery, "teacherId" | "branchId" | "type" | "from" | "to">,
) {
  const { from, to } = rangeOf(q);
  const filters = { teacherId: q.teacherId, branchId: q.branchId, from, to };
  const entries = await repo.listLedgerAll(prisma, { ...filters, type: q.type });
  const rows = entries.map(mapRow);
  const summary = await summaryFor(filters);
  const data: ReportData = {
    title: "Багшийн цалингийн тайлан",
    periodLabel: `${q.from ?? "эхнээс"} - ${q.to ?? "өнөөдөр хүртэл"}`,
    rows,
    summary: { ...summary, total: buildTotal(rows) },
  };
  if (q.format === "xlsx") {
    return {
      body: await buildXlsx(data),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "tsalin-tailan.xlsx",
      total: data.summary.total,
    };
  }
  return {
    body: await buildPdf(data),
    contentType: "application/pdf",
    filename: "tsalin-tailan.pdf",
    total: data.summary.total,
  };
}

// ФШ-68: админы самбарт сөрөг үлдэгдэлтэй (багшаас авах) багш нарын тоо, нийлбэр.
export async function negativeBalanceTeachers() {
  const rows = await payrollSummary({});
  const negative = rows.filter((r) => new Prisma.Decimal(r.balance).lt(0));
  const total = negative.reduce((acc, r) => acc.plus(r.balance), new Prisma.Decimal(0));
  return { count: negative.length, totalNegative: total.toFixed(2) };
}
