import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceStatus,
  type SetContractRatesResultDto,
  type StudentPayrollRowDto,
} from "@pitoo/contracts";
import { ListPlus } from "lucide-react";
import * as React from "react";
import { localDateKey } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Modal } from "@/shared/ui/modal";
import { AttendanceStatusChip } from "@/shared/ui/status-chip";
import { BulkRatesModal } from "./bulk-rates-modal";
import { useLedger, useMyStudentsPayroll, useStudentEntries, type PayrollPeriod } from "./payroll-api";
import {
  monthRange,
  num,
  periodLabel,
  PeriodBar,
  RateModal,
  SalaryHero,
  SalaryRow,
  type PeriodMode,
} from "./salary-parts";
import "./salary.css";

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

type Tab = "active" | "done";

// D-68, D-104: багшийн цалин сурагч (хүүхэд) бүрээр. Авах цалин = цалингийн цаг (60 мин) x тухайн хүүхдийн цагийн цалин.
export function TeacherSalaryPage() {
  const [mode, setMode] = React.useState<PeriodMode>("all");
  const [range, setRange] = React.useState<PayrollPeriod>({});
  const [tab, setTab] = React.useState<Tab>("active");
  const ledger = useLedger({ page: 1, from: range.from, to: range.to });
  const students = useMyStudentsPayroll(range);
  const [entriesRow, setEntriesRow] = React.useState<StudentPayrollRowDto | null>(null);
  const [rateRow, setRateRow] = React.useState<StudentPayrollRowDto | null>(null);
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [bulkResult, setBulkResult] = React.useState<SetContractRatesResultDto | null>(null);
  const [rateMessage, setRateMessage] = React.useState<string | null>(null);

  const all = students.data?.rows ?? [];
  const active = all.filter((r) => r.contractStatus !== "COMPLETED");
  const completed = all.filter((r) => r.contractStatus === "COMPLETED");
  const shown = tab === "done" ? completed : active;
  // Цалингийн цагийн нийлбэр (харагдац), 2 орны нарийвчлалтайгаар.
  const hoursTotal = String(Number(all.reduce((s, r) => s + Number(r.payrollHours), 0).toFixed(2)));
  const shownHours = String(Number(shown.reduce((s, r) => s + Number(r.payrollHours), 0).toFixed(2)));

  const choose = (next: PeriodMode) => {
    setMode(next);
    const today = localDateKey(new Date());
    if (next === "all") setRange({});
    else if (next === "this") setRange(monthRange(today, 0));
    else if (next === "last") setRange(monthRange(today, -1));
    else if (!range.from && !range.to) setRange(monthRange(today, 0));
  };

  return (
    <>
      {/* Толгой, хугацаа */}
      <section className="mt-4 flex flex-col justify-between gap-5 lg:mt-6 lg:flex-row lg:items-end">
        <div>
          <p className="pt-word block text-[12px] font-semibold tracking-[0.18em] text-brand-700" style={{ display: "block", animationDelay: "0.05s" }}>
            ЦАЛИН
          </p>
          <h1
            className="pt-word pt-tight mt-3 text-[40px] font-semibold leading-none sm:text-[54px]"
            style={{ display: "block", animationDelay: "0.15s" }}
          >
            Миний цалин
          </h1>
          <p className="pt-word mt-3 text-[15.5px] text-ink-500" style={{ display: "block", animationDelay: "0.3s" }}>
            Бодсон цалин, олгосон мөнгө, үлдэгдэл
          </p>
        </div>
        <PeriodBar
          mode={mode}
          from={range.from}
          to={range.to}
          onMode={choose}
          onFrom={(from) => {
            setMode("custom");
            setRange((r) => ({ ...r, from }));
          }}
          onTo={(to) => {
            setMode("custom");
            setRange((r) => ({ ...r, to }));
          }}
        />
      </section>

      {/* Хураангуй */}
      <SalaryHero summary={ledger.data?.summary} hoursTotal={hoursTotal} label={periodLabel(range.from, range.to)} />

      {/* Сурагч бүрээр */}
      <section className="mt-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="pt-tight text-[22px] font-semibold">Сурагч бүрээр</h2>
          <p className="mt-0.5 text-[13.5px] text-ink-500" data-testid="salary-list-info">
            {shown.length} сурагч · {shownHours} цалингийн цаг
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="sl-dot-ok size-2 rounded-full" />
              Төлбөр төлөгдсөн
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-gold-400" />
              Төлбөр төлөгдөөгүй
            </span>
          </p>
        </div>
        {/* D-99: бүх идэвхтэй хүүхдийн цагийн цалинг нэг цонхонд оруулна. */}
        <button
          type="button"
          disabled={active.length === 0}
          onClick={() => setBulkOpen(true)}
          data-testid="bulk-rate-open"
          className="inline-flex h-12 items-center gap-2 self-start rounded-full bg-brand-700 pl-4 pr-5 text-[14.5px] font-semibold text-white shadow-[0_14px_28px_-12px_rgba(139,26,26,0.8)] transition hover:bg-brand-800 disabled:opacity-50"
        >
          <ListPlus className="size-[18px]" aria-hidden="true" />
          Бүх хүүхдийн цагийн цалин оруулах
        </button>
      </section>

      {bulkResult ? (
        <p role="status" className="sl-ok-text mt-3 text-sm font-semibold" data-testid="bulk-rate-saved">
          {bulkResult.updated > 0
            ? `${bulkResult.updated} хүүхдийн цагийн цалин хадгалагдлаа.${
                bulkResult.adjusted > 0 ? ` Өмнөх ${bulkResult.adjusted} хичээлийн цалин шинэ цалингаар дахин бодогдлоо.` : ""
              }`
            : "Өөрчлөлт байгаагүй тул юу ч өөрчлөгдсөнгүй."}
        </p>
      ) : null}
      {rateMessage ? (
        <p role="status" className="sl-ok-text mt-3 text-sm font-semibold" data-testid="rate-saved">
          {rateMessage}
        </p>
      ) : null}

      <div className="sl-seg mt-5" role="tablist" aria-label="Сурагчийн төлөв">
        <button type="button" role="tab" aria-selected={tab === "active"} aria-controls="salary-panel" onClick={() => setTab("active")}>
          Суралцаж буй <span className="pt-num ml-1 opacity-60">{active.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === "done"} aria-controls="salary-panel" onClick={() => setTab("done")}>
          Амжилттай дууссан <span className="pt-num ml-1 opacity-60">{completed.length}</span>
        </button>
      </div>

      <section
        id="salary-panel"
        role="tabpanel"
        className="sl-card mt-3 overflow-hidden !rounded-[24px]"
        data-testid={tab === "done" ? "completed-students" : "salary-students"}
      >
        <div className="sl-cols hidden h-11 items-center border-b border-paper-3 bg-paper/60 px-5 text-[12px] font-medium text-ink-500 md:grid">
          <span>Сурагч</span>
          <span>Академик цаг</span>
          <span className="text-right">Цалингийн цаг</span>
          <span className="text-right">Цагийн цалин</span>
          <span className="text-right">Авах цалин</span>
          <span />
        </div>
        <ul className="divide-y divide-paper-3">
          {shown.map((r, i) => (
            <SalaryRow
              key={r.contractId}
              row={r}
              done={tab === "done"}
              index={i}
              onOpenEntries={() => setEntriesRow(r)}
              onEditRate={() => {
                setRateMessage(null);
                setRateRow(r);
              }}
            />
          ))}
        </ul>
        {students.isLoading ? <p className="p-8 text-center text-[14px] text-ink-500">Ачаалж байна...</p> : null}
        {students.data && shown.length === 0 ? (
          <p className="p-8 text-center text-[14px] text-ink-500">
            {tab === "done" ? "Багцаа дуусгасан сурагч алга байна." : "Идэвхтэй сурагч алга."}
          </p>
        ) : null}
      </section>
      {tab === "done" && completed.length > 0 ? (
        <p className="mt-2 text-[13px] text-ink-500">Багцаа дуусгасан сурагчид ({completed.length}). Цалингийн түүх хэвээр хадгалагдана.</p>
      ) : null}

      {entriesRow ? <EntriesModal row={entriesRow} period={range} onClose={() => setEntriesRow(null)} /> : null}
      {rateRow ? <RateModal row={rateRow} onClose={() => setRateRow(null)} onSaved={setRateMessage} /> : null}
      {bulkOpen ? (
        <BulkRatesModal
          rows={active}
          onClose={() => setBulkOpen(false)}
          onSaved={(result) => setBulkResult(result)}
        />
      ) : null}
    </>
  );
}
