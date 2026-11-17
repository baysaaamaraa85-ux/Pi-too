import type {
  MyStudentsPayrollDto,
  MyStudentsPayrollQuery,
  StudentPayrollEntryDto,
  StudentPayrollRowDto,
} from "@pitoo/contracts";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { balancesFor, teacherFlag } from "../../shared/payments/payment-status.js";
import { getContractDefaults } from "../catalog/catalog.service.js";
import * as repo from "./payroll.repository.js";
import { PAYROLL_COUNTED_STATUSES, applyDiscount, attendanceMinutes } from "./payroll.service.js";

// D-68: багшийн "Миний цалин" сурагч (гэрээ) бүрээр. Авах цалин = цалингийн цаг (60 мин) x цагийн цалин.

interface Actor {
  id: string;
  role: Role;
}

const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];

function rangeOf(q: { from?: string; to?: string }): repo.DateRange {
  return {
    from: q.from ? new Date(`${q.from}T00:00:00+08:00`) : undefined,
    to: q.to ? new Date(`${q.to}T23:59:59.999+08:00`) : undefined,
  };
}

function minutesBetween(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

function dateUb(d: Date): string {
  const local = new Date(d.getTime() + 8 * 3_600_000);
  return local.toISOString().slice(0, 10).replaceAll("-", ".");
}

const hours = (minutes: number, perHourMinutes: number) =>
  new Prisma.Decimal(minutes).div(perHourMinutes).toDecimalPlaces(2).toFixed(2);

export async function listMyStudents(actor: Actor, q: MyStudentsPayrollQuery): Promise<MyStudentsPayrollDto> {
  const range = rangeOf(q);
  const contracts = await repo.listContractsForTeacher(prisma, actor.id);
  const ids = contracts.map((c) => c.id);
  if (ids.length === 0) return { rows: [], totalEarned: "0.00" };

  const defaults = await getContractDefaults(prisma);
  const [attendance, earnings, balances, reminders] = await Promise.all([
    repo.listCountedAttendance(prisma, { teacherId: actor.id, contractIds: ids, statuses: PAYROLL_COUNTED_STATUSES, range }),
    repo.listEarningsForContracts(prisma, { teacherId: actor.id, contractIds: ids, range }),
    balancesFor(prisma, contracts),
    repo.latestReminders(prisma, ids),
  ]);

  const minutes = new Map<string, number>();
  for (const a of attendance) {
    minutes.set(a.contractId, (minutes.get(a.contractId) ?? 0) + attendanceMinutes(a, a.lesson));
  }
  const earned = new Map<string, Prisma.Decimal>();
  for (const e of earnings) {
    const id = e.attendance?.contractId;
    if (id) earned.set(id, (earned.get(id) ?? new Prisma.Decimal(0)).plus(e.amount));
  }

  const rows: StudentPayrollRowDto[] = [];
  let total = new Prisma.Decimal(0);
  for (const c of contracts) {
    const mins = minutes.get(c.id) ?? 0;
    const active = c.status === "ACTIVE" || c.status === "PAUSED";
    // Дууссан гэрээ тухайн хугацаанд цаг ороогүй бол жагсаалтад гаргахгүй.
    if (!active && mins === 0) continue;

    const rate = c.rates[0]?.hourlyRate ?? null;
    const amount = earned.get(c.id) ?? new Prisma.Decimal(0);
    total = total.plus(amount);
    const reminder = reminders.get(c.id);
    rows.push({
      contractId: c.id,
      studentId: c.student.id,
      studentName: c.student.fullName,
      programName: c.program.name,
      contractStatus: c.status,
      // D-70: багц академик цагаар (75).
      academicHoursExpected: String(c.totalHours.toNumber()),
      academicHoursDone: hours(mins, defaults.academicHourMinutes),
      payrollHours: hours(mins, 60),
      hourlyRate: rate ? rate.toFixed(2) : null,
      discountPercent: c.siblingDiscountPercent.toFixed(2),
      effectiveRate: rate ? applyDiscount(rate, c.siblingDiscountPercent).toFixed(2) : null,
      earned: amount.toFixed(2),
      paymentFlag: teacherFlag(balances.get(c.id)!),
      lastReminderAt: reminder ? reminder.toISOString() : null,
    });
  }
  return { rows, totalEarned: total.toFixed(2) };
}

// "Орсон цаг" дээр дарахад: тухайн хүүхдийн бүх ирц (хичээл бүр), цаг, цалин. Багш зөвхөн өөрийн хүүхдийг харна (BOLA).
export async function listStudentEntries(
  actor: Actor,
  contractId: string,
  q: MyStudentsPayrollQuery,
): Promise<StudentPayrollEntryDto[]> {
  if (!(await repo.teacherHasContract(prisma, actor.id, contractId))) {
    throw new DomainError({
      code: "forbidden-student-payroll",
      status: 403,
      title: "Эрх хүрэхгүй байна",
      detail: "Та зөвхөн өөрийн сурагчийн цалингийн дэлгэрэнгүйг харна.",
    });
  }
  const defaults = await getContractDefaults(prisma);
  const { rows, ledger } = await repo.listAttendanceEntries(prisma, {
    teacherId: actor.id,
    contractId,
    range: rangeOf(q),
  });
  const byAttendance = new Map<string, { amount: Prisma.Decimal; rate: Prisma.Decimal | null }>();
  for (const l of ledger) {
    if (!l.attendanceId) continue;
    const cur = byAttendance.get(l.attendanceId) ?? { amount: new Prisma.Decimal(0), rate: null };
    byAttendance.set(l.attendanceId, { amount: cur.amount.plus(l.amount), rate: l.rateUsed ?? cur.rate });
  }

  return rows.map((r) => {
    const mins = attendanceMinutes(r, r.lesson);
    const counted = PAYROLL_COUNTED_STATUSES.includes(r.status);
    const money = byAttendance.get(r.id);
    return {
      attendanceId: r.id,
      startsAt: r.lesson.startsAt.toISOString(),
      date: dateUb(r.lesson.startsAt),
      classLabel: `${WEEKDAYS[r.lesson.class.weekday - 1] ?? ""} ${r.lesson.class.startTime}`.trim(),
      branchName: r.lesson.class.branch.name,
      durationMin: mins,
      academicHours: counted ? hours(mins, defaults.academicHourMinutes) : "0.00",
      payrollHours: counted ? hours(mins, 60) : "0.00",
      status: r.status,
      counted,
      rateUsed: money?.rate ? money.rate.toFixed(2) : null,
      amount: (money?.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  });
}
