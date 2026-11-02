import type {
  AdminDashboardDto,
  AuditEntryDto,
  AuditQuery,
  DashboardDto,
  MonthlyReportDto,
  MonthlyReportRowDto,
  Paginated,
  TeacherDashboardDto,
} from "@pitoo/contracts";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { listLessonsForDay, listUnfilledLessons } from "../attendance/attendance.record.js";
import { negativeBalanceTeachers } from "../payroll/payroll.ledger.js";
import { getDebtSummary, listDebtBalances } from "../payments/payments.service.js";
import { listOpenTasks } from "../progress/progress.service.js";
import { todayInUlaanbaatar } from "../scheduling/scheduling.service.js";
import * as repo from "./reports.repository.js";

const MONGOLIA_OFFSET = "+08:00";
const NO_BRANCH = "none";

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ФШ-68, 70: нүүр хуудасны самбар. Админд хоёр карт ба өнөөдрийн хичээл, багшид өнөөдрийн
// хичээл, ирц бөглөөгүй хичээл, уулзалтын сануулга. Бусад үүрэгт эрх байхгүй (маршрутад).
export async function getDashboard(actor: { id: string; role: Role }): Promise<DashboardDto> {
  const today = dateKey(todayInUlaanbaatar());
  if (actor.role === Role.ADMIN) {
    const [debts, negativeTeachers, todayLessons] = await Promise.all([
      getDebtSummary(),
      negativeBalanceTeachers(),
      listLessonsForDay(actor, { date: today }),
    ]);
    const dto: AdminDashboardDto = { role: "ADMIN", debts, negativeTeachers, todayLessons };
    return dto;
  }
  const [todayLessons, unfilledLessons, tasks] = await Promise.all([
    listLessonsForDay(actor, { date: today }),
    listUnfilledLessons(actor),
    listOpenTasks(actor),
  ]);
  const dto: TeacherDashboardDto = { role: "TEACHER", todayLessons, unfilledLessons, tasks };
  return dto;
}

function monthRange(month: string): repo.MonthRange {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(mon)}-01`;
  const next = mon === 12 ? { y: year + 1, m: 1 } : { y: year, m: mon + 1 };
  const endDate = `${next.y}-${pad(next.m)}-01`;
  return {
    start: new Date(`${startDate}T00:00:00${MONGOLIA_OFFSET}`),
    end: new Date(`${endDate}T00:00:00${MONGOLIA_OFFSET}`),
    startDate,
    endDate,
  };
}

interface Acc {
  activeStudents: number;
  attendanceTotal: number;
  attendanceAttended: number;
  paymentsReceived: Prisma.Decimal;
  totalDebt: Prisma.Decimal;
  payrollCost: Prisma.Decimal;
  completedContracts: number;
  continuedContracts: number;
}

function emptyAcc(): Acc {
  const zero = new Prisma.Decimal(0);
  return {
    activeStudents: 0,
    attendanceTotal: 0,
    attendanceAttended: 0,
    paymentsReceived: zero,
    totalDebt: zero,
    payrollCost: zero,
    completedContracts: 0,
    continuedContracts: 0,
  };
}

function percent(part: number, whole: number): string | null {
  return whole > 0 ? ((part * 100) / whole).toFixed(1) : null;
}

function toRow(branchId: string | null, branchName: string, a: Acc): MonthlyReportRowDto {
  return {
    branchId,
    branchName,
    activeStudents: a.activeStudents,
    attendanceTotal: a.attendanceTotal,
    attendanceAttended: a.attendanceAttended,
    attendancePercent: percent(a.attendanceAttended, a.attendanceTotal),
    paymentsReceived: a.paymentsReceived.toFixed(2),
    totalDebt: a.totalDebt.toFixed(2),
    payrollCost: a.payrollCost.toFixed(2),
    completedContracts: a.completedContracts,
    continuedContracts: a.continuedContracts,
    continuationPercent: percent(a.continuedContracts, a.completedContracts),
  };
}

function isEmpty(a: Acc): boolean {
  return (
    a.activeStudents === 0 &&
    a.attendanceTotal === 0 &&
    a.paymentsReceived.isZero() &&
    a.totalDebt.isZero() &&
    a.payrollCost.isZero() &&
    a.completedContracts === 0
  );
}

// ФШ-69: салбар ба байгууллагын сарын тайлан. Байгууллагын мөр нь салбаруудын мөрийн НИЙЛБЭР
// (хувь нь нийлбэр тоонуудаас), тиймээс салбаруудын нийлбэр байгууллагынхтай үргэлж тэнцүү.
// Өр нь одоогийн байдлаар (сарын төгсгөлийн биш), `/debts`-ийн нийт өртэй ижил эх үүсвэр.
export async function getMonthlyReport(month: string): Promise<MonthlyReportDto> {
  const range = monthRange(month);
  const debts = await listDebtBalances();

  const data = await prisma.$transaction(async (tx) => {
    const [branches, students, attendance, payments, cost, cont, debtBranches] = await Promise.all([
      repo.listBranches(tx),
      repo.activeStudents(tx, range),
      repo.attendanceCounts(tx, range),
      repo.paymentsReceived(tx, range),
      repo.payrollCost(tx, range),
      repo.continuation(tx, range),
      repo.branchOfContracts(
        tx,
        debts.map((d) => d.contractId),
      ),
    ]);
    return { branches, students, attendance, payments, cost, cont, debtBranches };
  });

  const accs = new Map<string, Acc>();
  const accOf = (branchId: string | null) => {
    const key = branchId ?? NO_BRANCH;
    let acc = accs.get(key);
    if (!acc) accs.set(key, (acc = emptyAcc()));
    return acc;
  };
  for (const b of data.branches) accOf(b.id);

  for (const r of data.students) accOf(r.branchId).activeStudents += r.value;
  for (const r of data.attendance) {
    const a = accOf(r.branchId);
    a.attendanceTotal += r.total;
    a.attendanceAttended += r.attended;
  }
  for (const r of data.payments) {
    const a = accOf(r.branchId);
    a.paymentsReceived = a.paymentsReceived.plus(r.value);
  }
  for (const r of data.cost) {
    const a = accOf(r.branchId);
    a.payrollCost = a.payrollCost.plus(r.value);
  }
  for (const r of data.cont) {
    const a = accOf(r.branchId);
    a.completedContracts += r.completed;
    a.continuedContracts += r.continued;
  }
  const branchOfContract = new Map(data.debtBranches.map((d) => [d.contractId, d.branchId]));
  for (const d of debts) {
    const a = accOf(branchOfContract.get(d.contractId) ?? null);
    a.totalDebt = a.totalDebt.plus(d.balance);
  }

  const rows: MonthlyReportRowDto[] = data.branches.map((b) => toRow(b.id, b.name, accOf(b.id)));
  const noBranch = accs.get(NO_BRANCH);
  if (noBranch && !isEmpty(noBranch)) rows.push(toRow(null, "Салбаргүй", noBranch));

  const total = emptyAcc();
  for (const acc of accs.values()) {
    total.activeStudents += acc.activeStudents;
    total.attendanceTotal += acc.attendanceTotal;
    total.attendanceAttended += acc.attendanceAttended;
    total.paymentsReceived = total.paymentsReceived.plus(acc.paymentsReceived);
    total.totalDebt = total.totalDebt.plus(acc.totalDebt);
    total.payrollCost = total.payrollCost.plus(acc.payrollCost);
    total.completedContracts += acc.completedContracts;
    total.continuedContracts += acc.continuedContracts;
  }
  return { month, branches: rows, total: toRow(null, "Байгууллага", total) };
}

// Аудитын бүртгэл (админ): entity, үйлдэл, хийсэн хүн, огноогоор шүүнэ. Огноо Улаанбаатарын өдрөөр.
export async function listAudit(q: AuditQuery): Promise<Paginated<AuditEntryDto>> {
  const from = q.from ? new Date(`${q.from}T00:00:00${MONGOLIA_OFFSET}`) : undefined;
  const to = q.to ? new Date(new Date(`${q.to}T00:00:00${MONGOLIA_OFFSET}`).getTime() + 24 * 3_600_000) : undefined;
  const [rows, total] = await repo.listAudit(prisma, { ...q, from, to });
  return {
    items: rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      action: r.action,
      before: r.before,
      after: r.after,
      reason: r.reason,
      actor: r.actor.phone ?? r.actor.email ?? r.actorId,
      createdAt: r.createdAt.toISOString(),
    })),
    page: q.page,
    limit: q.limit,
    total,
  };
}
