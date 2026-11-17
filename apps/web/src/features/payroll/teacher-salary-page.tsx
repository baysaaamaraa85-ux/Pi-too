import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus, type StudentPayrollRowDto } from "@pitoo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatDate } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { AttendanceStatusChip, StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { BalanceCards } from "./payroll-parts";
import { useLedger, useMyStudentsPayroll, useStudentEntries, type LedgerFilters, type PayrollPeriod } from "./payroll-api";

// "3.00" -> "3", "2.50" -> "2.5".
const num = (value: string) => String(Number(value));

// Нэг мөрийн тоон үзүүлэлт: дээр нь жижиг нэр, доор нь том тоо. md-ээс дээш хоорондоо нарийн зураастай.
function Stat({
  label,
  sub,
  children,
  testId,
  emphasis = false,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  testId?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("min-w-0 px-1 py-1 md:px-5 md:first:pl-0 md:last:pr-0", emphasis && "md:bg-transparent")} data-testid={testId}>
      <p className="text-xs font-bold uppercase leading-tight tracking-wider text-muted">{label}</p>
      {sub ? <p className="text-xs leading-tight text-muted">{sub}</p> : null}
      <div className={cn("mt-1 text-xl font-bold tabular-nums text-foreground-strong", emphasis && "text-primary")}>{children}</div>
    </div>
  );
}

// "Орсон цаг" дээр дарахад: тухайн хүүхдийн хичээл бүрийн огноо, цаг, цалин доошоо жагсана (шинэ нь эхэнд).
// Хугацаа, академик цаг, томьёо зэрэг давхардсан мэдээлэл харуулахгүй, ирсэн биш төлвийг л тэмдэглэнэ.
function EntriesModal({
  row,
  period,
  onClose,
}: {
  row: StudentPayrollRowDto;
  period: PayrollPeriod;
  onClose: () => void;
}) {
  const entries = useStudentEntries(row.contractId, period);
  return (
    <Modal open title={`${row.studentName}: орсон цаг`} description={row.programName} onClose={onClose}>
      {entries.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {entries.data && entries.data.length === 0 ? <p className="text-sm text-muted">Энэ хугацаанд хичээл алга.</p> : null}
      <ul className="grid max-h-[60vh] divide-y divide-border-warm overflow-y-auto" data-testid="entries-list">
        {entries.data?.map((e) => (
          <li key={e.attendanceId} className="flex items-center justify-between gap-3 py-2.5" data-testid="entry-row">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-strong">{e.date}</p>
              <p className="text-[0.8125rem] text-muted">{e.classLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-sm">
              {e.status !== "PRESENT" ? (
                <AttendanceStatusChip status={e.status} label={ATTENDANCE_STATUS_LABELS[e.status as AttendanceStatus]} />
              ) : null}
              <span className="tabular-nums text-mid">{num(e.payrollHours)} цаг</span>
              <span className="w-24 text-right font-bold tabular-nums text-primary" data-testid="entry-amount">
                {formatMoney(e.amount)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// Төлөгдөөгүй хүүхдийн эцэг эхэд мэдэгдэл, нэхэмжлэл илгээнэ (өдөрт нэг удаа).
function ReminderButton({ row }: { row: StudentPayrollRowDto }) {
  const queryClient = useQueryClient();
  const [sent, setSent] = React.useState<number | null>(null);
  const send = useMutation({
    mutationFn: () => api.post<{ notified: number }>(`/contracts/${row.contractId}/payment-reminder`),
    onSuccess: async (data) => {
      setSent(data.notified);
      await queryClient.invalidateQueries({ queryKey: ["my-students-payroll"] });
    },
  });
  return (
    <div className="grid gap-1.5">
      <Button type="button" variant="secondary" className="w-fit" disabled={send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? "Илгээж байна..." : "Эцэг эхэд мэдэгдэл илгээх"}
      </Button>
      {sent !== null ? (
        <p className="text-sm font-semibold text-success" data-testid="reminder-sent">
          Эцэг эхэд мэдэгдэл илгээгдлээ.
        </p>
      ) : null}
      <FormError message={errorMessage(send.error)} />
      {row.lastReminderAt ? (
        <p className="text-xs text-muted">Сүүлд илгээсэн: {formatDate(row.lastReminderAt)}</p>
      ) : null}
    </div>
  );
}

function StudentCard({ row, onOpen }: { row: StudentPayrollRowDto; onOpen: () => void }) {
  const debt = row.paymentFlag === "DEBT";
  const discount = Number(row.discountPercent);
  return (
    <Card className="p-5" data-testid="salary-student">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-bold text-foreground-strong" data-testid="salary-student-name">
            {row.studentName}
          </p>
          <p className="text-sm text-muted">{row.programName}</p>
        </div>
        <StatusChip tone={debt ? "warning" : "success"}>
          <span data-testid="salary-payment">{debt ? "Төлөгдөөгүй" : "Төлөгдсөн"}</span>
        </StatusChip>
      </div>

      {/* Бүх тоон үзүүлэлт нэг мөрөнд (утсанд 2 баганад). */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-background-soft/70 p-4 md:grid-cols-5 md:divide-x md:divide-border-warm md:gap-x-0 md:p-5">
        <Stat label="Академик цаг" sub="орох ёстой" testId="salary-expected">
          {num(row.academicHoursExpected)}
        </Stat>
        <Stat label="Академик цаг" sub="орсон" testId="salary-academic">
          {num(row.academicHoursDone)}
        </Stat>
        <Stat label="Цалингийн цаг" sub="60 мин, орсон">
          <button
            type="button"
            onClick={onOpen}
            data-testid="salary-hours"
            className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1 text-xl font-bold text-primary underline decoration-dotted underline-offset-4 hover:bg-primary/6"
            aria-label={`${row.studentName}: орсон цаг ${num(row.payrollHours)}, дэлгэрэнгүй харах`}
          >
            {num(row.payrollHours)}
          </button>
        </Stat>
        <Stat label="Цагийн цалин" sub={discount > 0 ? `хөнгөлөлт ${discount}%` : "1 цагийн"} testId="salary-rate">
          {row.effectiveRate ? formatMoney(row.effectiveRate) : <span className="text-warning">Оруулаагүй</span>}
        </Stat>
        <Stat label="Авах цалин" sub="цаг x цагийн цалин" testId="salary-earned" emphasis>
          {formatMoney(row.earned)}
        </Stat>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <Link
          to={`/teacher/students/${row.studentId}`}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {row.hourlyRate ? "Цагийн цалинг засах" : "Цагийн цалин оруулах"}
        </Link>
        {debt ? <ReminderButton row={row} /> : null}
      </div>
    </Card>
  );
}

// D-73: 75 цагийн багц дууссан сурагч "Амжилттай дууссан сурагчид" хэсэгт орно (цалингийн түүх хэвээр).
function CompletedRow({ row, onOpen }: { row: StudentPayrollRowDto; onOpen: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3" data-testid="completed-student">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground-strong">{row.studentName}</p>
        <p className="text-[0.8125rem] text-muted">{row.programName}</p>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <button
          type="button"
          onClick={onOpen}
          data-testid="completed-hours"
          className="inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-primary underline decoration-dotted underline-offset-4 hover:bg-primary/6"
          aria-label={`${row.studentName}: орсон цаг ${num(row.payrollHours)}, дэлгэрэнгүй харах`}
        >
          {num(row.payrollHours)} цаг
        </button>
        <span className="w-28 text-right font-bold tabular-nums text-foreground-strong">{formatMoney(row.earned)}</span>
      </div>
    </li>
  );
}

// D-68: багшийн цалин сурагч (хүүхэд) бүрээр. Авах цалин = цалингийн цаг (60 мин) x тухайн хүүхдийн цагийн цалин.
export function TeacherSalaryPage() {
  const [filters, setFilters] = React.useState<LedgerFilters>({ page: 1 });
  const period: PayrollPeriod = { from: filters.from, to: filters.to };
  const ledger = useLedger({ page: 1, from: filters.from, to: filters.to });
  const students = useMyStudentsPayroll(period);
  const [open, setOpen] = React.useState<StudentPayrollRowDto | null>(null);
  const all = students.data?.rows ?? [];
  const rows = all.filter((r) => r.contractStatus !== "COMPLETED");
  const completedRows = all.filter((r) => r.contractStatus === "COMPLETED");

  return (
    <>
      <PageHeader title="Миний цалин" subtitle="Олсон цалин, олгосон мөнгө, үлдэгдэл" />
      <BalanceCards summary={ledger.data?.summary} />

      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <Field label="Эхлэх огноо" htmlFor="ts-from">
          <Input
            id="ts-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilters({ ...filters, page: 1, from: e.target.value || undefined })}
          />
        </Field>
        <Field label="Дуусах огноо" htmlFor="ts-to">
          <Input
            id="ts-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilters({ ...filters, page: 1, to: e.target.value || undefined })}
          />
        </Field>
      </div>

      {students.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {students.data && rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Идэвхтэй сурагч алга.
        </p>
      ) : null}
      <ul className="grid gap-4" data-testid="salary-students">
        {rows.map((r) => (
          <li key={r.contractId}>
            <StudentCard row={r} onOpen={() => setOpen(r)} />
          </li>
        ))}
      </ul>
      {completedRows.length > 0 ? (
        <section className="mt-8" aria-labelledby="completed-title" data-testid="completed-students">
          <h2 id="completed-title" className="font-display text-lg font-bold text-foreground-strong">
            Амжилттай дууссан сурагчид
          </h2>
          <p className="mb-2 text-[0.8125rem] text-muted">75 цагийн багцаа дуусгасан сурагчид ({completedRows.length})</p>
          <Card className="px-4 shadow-soft">
            <ul className="divide-y divide-border-warm">
              {completedRows.map((r) => (
                <CompletedRow key={r.contractId} row={r} onOpen={() => setOpen(r)} />
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
      {open ? <EntriesModal row={open} period={period} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
