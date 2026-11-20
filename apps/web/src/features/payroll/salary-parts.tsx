import type { LedgerSummaryDto, StudentPayrollRowDto } from "@pitoo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Calculator, CalendarRange, CircleCheck, Pencil, Send, Wallet } from "lucide-react";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatDate } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { cn } from "@/shared/ui/utils";
import { MONEY_INPUT, toMoney } from "./rates-ui";
import "./salary.css";

// D-104: багшийн "Миний цалин" хуудасны хэсгүүд. Загвар: teacher_salary_v2.html.

// "3.00" -> "3", "2.50" -> "2.5".
export const num = (value: string) => String(Number(value));

// ---- Хугацаа ----

export type PeriodMode = "all" | "this" | "last" | "custom";

// Улаанбаатарын өнөөдрийн огноо (YYYY-MM-DD) өгч, энэ сар (өнөөдөр хүртэл) эсвэл өмнөх сарын бүтэн хугацааг буцаана.
export function monthRange(todayKey: string, offset: 0 | -1): { from: string; to: string } {
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const to = offset === 0 ? todayKey : new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  return { from: first.toISOString().slice(0, 10), to };
}

const dotted = (key: string) => key.replaceAll("-", ".");

export function periodLabel(from?: string, to?: string): string {
  if (!from && !to) return "Бүх хугацаа";
  return `${from ? dotted(from) : "..."} - ${to ? dotted(to) : "..."}`;
}

const MODES: { key: PeriodMode; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "this", label: "Энэ сар" },
  { key: "last", label: "Өмнөх сар" },
  { key: "custom", label: "Сонгох" },
];

export function PeriodBar({
  mode,
  from,
  to,
  onMode,
  onFrom,
  onTo,
}: {
  mode: PeriodMode;
  from: string | undefined;
  to: string | undefined;
  onMode: (next: PeriodMode) => void;
  onFrom: (value: string | undefined) => void;
  onTo: (value: string | undefined) => void;
}) {
  return (
    <div className="sl-in flex flex-col gap-2 sm:flex-row sm:items-center" style={{ animationDelay: "0.35s" }}>
      <div className="sl-seg self-start" role="group" aria-label="Хугацаа">
        {MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => onMode(m.key)} data-testid={`period-${m.key}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="inline-flex min-h-[52px] max-w-full items-center gap-1 self-start rounded-full border border-paper-3 bg-white pl-4 pr-1.5">
        <CalendarRange className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <label className="sr-only" htmlFor="ts-from">
          Эхлэх огноо
        </label>
        <input
          id="ts-from"
          type="date"
          value={from ?? ""}
          onChange={(e) => onFrom(e.target.value || undefined)}
          className="pt-num h-11 min-w-0 bg-transparent px-1.5 text-[13.5px] font-semibold focus:outline-none"
        />
        <ArrowRight className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        <label className="sr-only" htmlFor="ts-to">
          Дуусах огноо
        </label>
        <input
          id="ts-to"
          type="date"
          value={to ?? ""}
          onChange={(e) => onTo(e.target.value || undefined)}
          className="pt-num h-11 min-w-0 bg-transparent px-1.5 text-[13.5px] font-semibold focus:outline-none"
        />
      </div>
    </div>
  );
}

// ---- Хураангуй ----

// Дүнг 0-ээс өсгөж харуулна (зөвхөн харагдац). Эцсийн утга үргэлж API-ийн тэмдэгт мөрөөр, number-оор тооцоолоогүй.
// prefers-reduced-motion үед шууд эцсийн утга.
export function useCountUp(target: string | undefined): string | undefined {
  const [shown, setShown] = React.useState<string | undefined>(target);
  const prev = React.useRef(0);
  React.useEffect(() => {
    if (target === undefined) {
      setShown(undefined);
      return;
    }
    const to = Number(target);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !Number.isFinite(to)) {
      setShown(target);
      prev.current = Number.isFinite(to) ? to : 0;
      return;
    }
    const from = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / 1100, 1);
      if (p < 1) {
        setShown(String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))));
        raf = requestAnimationFrame(step);
      } else {
        setShown(target);
        prev.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export function SalaryHero({
  summary,
  hoursTotal,
  label,
}: {
  summary: LedgerSummaryDto | undefined;
  hoursTotal: string;
  label: string;
}) {
  const balance = useCountUp(summary?.balance);
  const earned = useCountUp(summary?.earned);
  const paid = useCountUp(summary?.paid);
  // Харагдацын хувь, сөрөг эсэх (ФШ-57). Мөнгөн нийлбэр тооцоолохгүй.
  const negative = summary ? Number(summary.balance) < 0 : false;
  const earnedNum = summary ? Number(summary.earned) : 0;
  const pct = earnedNum > 0 ? Math.max(0, Math.min(100, Math.round((Number(summary?.paid) / earnedNum) * 100))) : 0;
  const balanceText = balance === undefined ? "..." : formatMoney(balance).replace(/ ₮$/, "");

  return (
    <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <article
        className="sl-dark sl-in flex min-h-[260px] flex-col rounded-[32px] p-6 sm:p-8 lg:col-span-7"
        style={{ animationDelay: "0.2s" }}
        data-testid="card-balance"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 70% at 85% 20%,rgba(139,26,26,.75),transparent 70%),radial-gradient(40% 50% at 0% 100%,rgba(242,174,58,.16),transparent 70%)",
          }}
        />
        <div className="pt-dots" />
        <div className="pt-noise" />
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 text-[12.5px] font-medium text-white/85">
            <Wallet className="size-3.5 text-gold-300" aria-hidden="true" />
            Олгох үлдэгдэл
          </span>
          <span className="pt-num hidden text-[12.5px] text-white/60 sm:inline">{label}</span>
        </div>
        <div className="relative mt-6 flex items-end gap-2">
          <span
            className="pt-tight pt-num text-[52px] font-semibold leading-none sm:text-[64px]"
            style={{ textShadow: "0 2px 24px rgba(74,10,10,.8)" }}
          >
            {balanceText}
          </span>{" "}
          <span className="pb-1.5 text-[24px] font-semibold text-white/70">₮</span>
        </div>
        {negative ? (
          <p className="relative mt-3 text-[13px] font-semibold text-gold-300">Сөрөг үлдэгдэл: олсноосоо их авсан</p>
        ) : null}
        <div className="relative mt-auto pt-7">
          <div className="mb-2 flex justify-between text-[12.5px] text-white/60">
            <span>Олгосон</span>
            <span className="pt-num">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="sl-bar-fill h-full rounded-full bg-gold-400 shadow-[0_0_14px_rgba(242,174,58,0.6)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </article>

      <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:grid-cols-1 lg:gap-5">
        <article
          className="sl-card sl-in flex flex-col gap-4 !rounded-[26px] p-5 sm:flex-row sm:items-center sm:p-6"
          style={{ animationDelay: "0.28s" }}
          data-testid="card-earned"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Calculator className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-ink-500">Бодсон цалин</p>
            <p className="pt-tight pt-num mt-0.5 text-[26px] font-semibold leading-tight">
              {earned === undefined ? "..." : formatMoney(earned)}
            </p>
          </div>
          <span className="pt-num hidden h-8 items-center rounded-full bg-paper-2 px-3 text-[12.5px] font-semibold text-ink-600 sm:inline-flex">
            {hoursTotal} цаг
          </span>
        </article>
        <article
          className="sl-card sl-in flex flex-col gap-4 !rounded-[26px] p-5 sm:flex-row sm:items-center sm:p-6"
          style={{ animationDelay: "0.34s" }}
          data-testid="card-paid"
        >
          <span className="sl-done-avatar grid size-11 shrink-0 place-items-center rounded-2xl">
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-medium text-ink-500">Олгосон</p>
            <p className="pt-tight pt-num mt-0.5 text-[26px] font-semibold leading-tight">
              {paid === undefined ? "..." : formatMoney(paid)}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

// ---- Сурагчийн мөр ----

export function SalaryRow({
  row,
  done,
  index,
  onOpenEntries,
  onEditRate,
}: {
  row: StudentPayrollRowDto;
  done: boolean;
  index: number;
  onOpenEntries: () => void;
  onEditRate: () => void;
}) {
  const queryClient = useQueryClient();
  const [sent, setSent] = React.useState(false);
  const debt = row.paymentFlag === "DEBT";
  const discount = Number(row.discountPercent);
  // Харагдацын хувь (мөнгө биш, цаг).
  const expected = Number(row.academicHoursExpected);
  const pct = expected > 0 ? Math.min(100, (Number(row.academicHoursDone) / expected) * 100) : 0;
  const earned = Number(row.earned) > 0;

  // Төлөгдөөгүй хүүхдийн эцэг эхэд мэдэгдэл, нэхэмжлэл илгээнэ (өдөрт нэг удаа).
  const remind = useMutation({
    mutationFn: () => api.post<{ notified: number }>(`/contracts/${row.contractId}/payment-reminder`),
    onSuccess: async () => {
      setSent(true);
      await queryClient.invalidateQueries({ queryKey: ["my-students-payroll"] });
    },
  });
  const reminderError = errorMessage(remind.error);

  return (
    <li
      className="sl-row sl-in px-4 py-3.5 sm:px-5"
      style={{ animationDelay: `${0.03 + Math.min(index, 10) * 0.04}s` }}
      data-testid={done ? "completed-student" : "salary-student"}
    >
      <div className="sl-cols flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[13px] text-[16px] font-semibold",
              done ? "sl-done-avatar" : "bg-brand-700 text-white",
            )}
            aria-hidden="true"
          >
            {done ? <BadgeCheck className="size-5" /> : row.studentName.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="break-words text-[15px] font-semibold md:truncate" data-testid="salary-student-name">
                {row.studentName}
              </span>
              <span
                className={cn("size-2 shrink-0 rounded-full", debt ? "bg-gold-400" : "sl-dot-ok")}
                aria-hidden="true"
              />
            </div>
            <p className="text-[12.5px] text-ink-500 md:truncate">
              {row.programName} ·{" "}
              <span className={debt ? "sl-due-text font-semibold" : "sl-ok-text font-semibold"} data-testid="salary-payment">
                {debt ? "Төлөгдөөгүй" : "Төлөгдсөн"}
              </span>
            </p>
          </div>
        </div>

        <div className="order-last flex w-full items-center gap-3 pl-[52px] md:order-none md:w-auto md:pl-0">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
            <div
              className={cn("sl-bar-fill h-full rounded-full", done ? "sl-dot-ok" : "bg-brand-700")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="pt-num w-[58px] text-right text-[12.5px] font-semibold text-ink-600">
            <span data-testid="salary-academic">{num(row.academicHoursDone)}</span>/
            <span data-testid="salary-expected">{num(row.academicHoursExpected)}</span>
          </span>
        </div>

        <span className="pt-num order-last pl-[52px] text-[12.5px] text-ink-500 md:order-none md:pl-0 md:text-right md:text-[15px] md:font-semibold md:text-ink-900">
          <button
            type="button"
            onClick={onOpenEntries}
            data-testid={done ? "completed-hours" : "salary-hours"}
            className="-ml-1 inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-brand-700 underline decoration-dotted underline-offset-4 hover:bg-brand-50"
            aria-label={`${row.studentName}: орсон цаг ${num(row.payrollHours)}, дэлгэрэнгүй харах`}
          >
            {num(row.payrollHours)}
          </button>
          <span className="font-medium text-ink-400 md:text-[12.5px]"> цаг</span>
        </span>

        <span className="pt-num order-last text-[12.5px] text-ink-500 md:order-none md:text-right md:text-[14.5px] md:font-semibold md:text-ink-900">
          <span className="md:hidden">× </span>
          <span data-testid="salary-rate">
            {row.effectiveRate ? formatMoney(row.effectiveRate) : <span className="text-gold-600">Оруулаагүй</span>}
          </span>
          {discount > 0 ? <span className="block text-[11px] font-medium text-ink-400">хөнгөлөлт {discount}%</span> : null}
        </span>

        <span
          className={cn("pt-num text-right text-[16px] font-semibold", earned ? "text-brand-700" : "text-ink-400")}
          data-testid="salary-earned"
        >
          {formatMoney(row.earned)}
        </span>

        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            className="sl-ibtn"
            onClick={onEditRate}
            aria-label={`${row.studentName}: цагийн цалин засах`}
            title="Цагийн цалин засах"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          {debt && !done ? (
            <button
              type="button"
              className="sl-ibtn"
              disabled={remind.isPending}
              onClick={() => remind.mutate()}
              aria-label={`${row.studentName}: эцэг эхэд мэдэгдэл илгээх`}
              title="Эцэг эхэд мэдэгдэл илгээх"
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {sent || row.lastReminderAt || reminderError ? (
        <div className="mt-2 grid gap-0.5 pl-[52px] text-[12.5px] md:pl-[52px]">
          {sent ? (
            <p role="status" className="sl-ok-text font-semibold" data-testid="reminder-sent">
              Эцэг эхэд мэдэгдэл илгээгдлээ.
            </p>
          ) : null}
          {reminderError ? (
            <p role="alert" className="font-semibold text-danger">
              {reminderError}
            </p>
          ) : null}
          {row.lastReminderAt ? <p className="text-ink-500">Сүүлд илгээсэн: {formatDate(row.lastReminderAt)}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

// ---- Цагийн цалин засах цонх ----

// Одоо байгаа PUT /contracts/:id/rate (D-67, D-68): засвар энэ хүүхдийн бүх хичээлийн цалинд үйлчилнэ.
export function RateModal({
  row,
  onClose,
  onSaved,
}: {
  row: StudentPayrollRowDto;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState(row.hourlyRate ? String(Number(row.hourlyRate)) : "");
  const valid = MONEY_INPUT.test(amount.replace(/[\s,]/g, ""));
  const discount = Number(row.discountPercent);
  const save = useMutation({
    mutationFn: () => api.put<{ adjusted: number }>(`/contracts/${row.contractId}/rate`, { hourlyRate: toMoney(amount) }),
    onSuccess: async (data) => {
      await Promise.all(
        ["my-rates", "my-students-payroll", "ledger", "dashboard"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onSaved(
        `${row.studentName}: цагийн цалин хадгалагдлаа.${
          data.adjusted > 0 ? ` Өмнөх ${data.adjusted} хичээлийн цалин шинэ цалингаар дахин бодогдлоо.` : ""
        }`,
      );
      onClose();
    },
  });

  return (
    <Modal open title="Цагийн цалин засах" description={`${row.studentName} · ${row.programName}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <Field label="1 цагийн цалин (₮)" htmlFor="sl-rate">
          <Input
            id="sl-rate"
            inputMode="decimal"
            placeholder="40000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Засвар энэ хүүхдийн бүх хичээлийн (өмнөх ба дараах) цалинд үйлчилнэ.
          {discount > 0 ? ` Ах дүүгийн хөнгөлөлт ${discount}% хэрэглэгдэнэ.` : ""}
        </p>
        <FormError message={errorMessage(save.error)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>
            Болих
          </Button>
          <Button type="submit" disabled={!valid || save.isPending} data-testid="rate-save">
            {save.isPending ? "Хадгалж байна..." : "Хадгалах"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
