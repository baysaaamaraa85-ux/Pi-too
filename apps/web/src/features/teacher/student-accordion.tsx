import {
  CONTRACT_STATUS_LABELS,
  MAX_STUDENT_CATEGORIES,
  type ContractStatus,
  type TeacherCategoriesDto,
  type TeacherPaymentFlag,
} from "@pitoo/contracts";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CalendarOff,
  Check,
  ChevronDown,
  ChartLine,
  ListChecks,
  MapPin,
  MoreVertical,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { weekdayName } from "@/shared/format/date";
import { formatHours } from "@/shared/format/hours";
import { cn } from "@/shared/ui/utils";
import { useRefreshCategories } from "./categories-ui";
import "./students.css";

// D-103: сурагч бүр нэг мөр. Мөрийг дарахад (баруун талын сумаар) дэлгэрэнгүй доош тэлнэ. Загвар: teacher_students_v2.html.

export interface ContractRow {
  id: string;
  studentId: string;
  studentName: string;
  programName: string;
  status: ContractStatus;
  totalHours: number;
  remainingHours: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  meetingsCount: number;
  paymentFlag: TeacherPaymentFlag;
  planItems: { position: number; topic: string; doneAt: string | null }[];
  activePause: { startedOn: string; holdSeat: boolean; reason: string } | null;
  classes: {
    id: string;
    branchId: string;
    branchName: string;
    weekday: number;
    startTime: string;
    teacherId: string;
    teacherName: string;
  }[];
}

const shortDay = (weekday: number) => weekdayName(weekday).slice(0, 2);

// Хуваарийн товч: "Да, Мя 16:00" (бүх цаг нэг бол цагтай, өөр өөр бол зөвхөн гараг).
function scheduleSummary(classes: ContractRow["classes"]): string {
  if (classes.length === 0) return "Хуваарьгүй";
  const sorted = [...classes].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  const days = sorted.map((c) => shortDay(c.weekday)).join(", ");
  const times = new Set(sorted.map((c) => c.startTime));
  return times.size === 1 ? `${days} ${sorted[0]!.startTime}` : days;
}

function PaymentBadge({ flag }: { flag: TeacherPaymentFlag }) {
  return flag === "DEBT" ? (
    <span className="ts-badge-due inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold">
      <span className="size-1.5 rounded-full bg-gold-400" aria-hidden="true" />
      Төлбөр үлдэгдэлтэй
    </span>
  ) : (
    <span className="ts-badge-ok inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold">
      <Check className="size-3.5" aria-hidden="true" />
      Төлбөр төлөгдсөн
    </span>
  );
}

function StatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return status === "ACTIVE" ? (
    <span className={cn("ts-badge-ok inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold", className)}>
      <span className="ts-dot-ok size-1.5 rounded-full" aria-hidden="true" />
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  ) : (
    <span className={cn("inline-flex h-7 items-center rounded-full bg-paper-2 px-2.5 text-[12px] font-semibold text-ink-500", className)}>
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

// ⋮ цэс: сурагчийг дээд тал нь 2 категорид оруулна (D-98). Esc, гадна дарахад хаагдаж, фокус товч руу буцна.
function CategoryMenu({
  studentId,
  studentName,
  categories,
}: {
  studentId: string;
  studentName: string;
  categories: TeacherCategoriesDto | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const refresh = useRefreshCategories();
  const set = useMutation({
    mutationFn: (categoryIds: string[]) => api.put(`/teacher/students/${studentId}/categories`, { categoryIds }),
    onSuccess: refresh,
  });

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const list = categories?.categories ?? [];
  const current = (categories?.assignments ?? []).filter((a) => a.studentId === studentId).map((a) => a.categoryId);
  const full = current.length >= MAX_STUDENT_CATEGORIES;
  const toggle = (id: string) => set.mutate(current.includes(id) ? current.filter((c) => c !== id) : [...current, id]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full text-ink-500 hover:bg-paper-2 hover:text-ink-900"
        aria-label={`${studentName}: категори сонгох`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="category-menu-button"
      >
        <MoreVertical className="size-[18px]" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`${studentName}: категори`}
          className="pt-glass absolute right-0 top-12 z-30 w-[240px] rounded-[18px] !bg-white/95 p-2"
          data-testid="category-menu"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] font-semibold tracking-[0.12em] text-ink-400">
            КАТЕГОРИ (ДЭЭД ТАЛ НЬ {MAX_STUDENT_CATEGORIES})
          </p>
          {list.length === 0 ? (
            <p className="px-2.5 pb-2 text-[13px] text-ink-500">
              Категори алга. Дээрх &quot;Категори&quot; товчоор үүсгэнэ үү.
            </p>
          ) : null}
          {list.map((c) => {
            const on = current.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                disabled={set.isPending || (full && !on)}
                onClick={() => toggle(c.id)}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-2.5 text-left text-[14px] font-medium hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-45"
                data-testid="category-menu-item"
              >
                {c.name}
                {on ? <Check className="size-4 text-brand-700" aria-hidden="true" /> : null}
              </button>
            );
          })}
          {errorMessage(set.error) ? (
            <p role="alert" className="px-2.5 pb-1 pt-1.5 text-[12.5px] font-semibold text-danger">
              {errorMessage(set.error)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface StudentRowProps {
  contract: ContractRow;
  index: number;
  open: boolean;
  onToggle: () => void;
  userId: string | undefined;
  categories: TeacherCategoriesDto | undefined;
  // Тохиргооноос: ФШ-36 багц дуусах босго (цаг), анхдагч чөлөөний эрх.
  lowHours: number | undefined;
  maxLeaves: number | undefined;
  onPlan: () => void;
  onTransfer: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function StudentRow({
  contract: c,
  index,
  open,
  onToggle,
  userId,
  categories,
  lowHours,
  maxLeaves,
  onPlan,
  onTransfer,
  onPause,
  onResume,
}: StudentRowProps) {
  const active = c.status === "ACTIVE";
  const low = active && lowHours !== undefined && c.remainingHours <= lowHours;
  const pct = c.totalHours > 0 ? Math.min(100, (c.remainingHours / c.totalHours) * 100) : 0;
  const branches = [...new Set(c.classes.map((x) => x.branchName))];
  const sorted = [...c.classes].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
  const bodyId = `student-body-${c.id}`;

  const categoryNames = (categories?.assignments ?? [])
    .filter((a) => a.studentId === c.studentId)
    .map((a) => categories?.categories.find((x) => x.id === a.categoryId)?.name)
    .filter((n): n is string => !!n);
  const categoryChips = categoryNames.map((n) => (
    <span key={n} className="inline-flex h-7 items-center rounded-full bg-ink-900 px-2.5 text-[12px] font-semibold text-white">
      {n}
    </span>
  ));

  const segments = Math.max(maxLeaves ?? 0, c.leavesLeft);

  return (
    <article
      className={cn("ts-stu ts-card ts-in !rounded-[24px]", !active && "opacity-75")}
      data-open={open}
      data-testid="student-card"
      style={{ animationDelay: `${0.05 + Math.min(index, 8) * 0.05}s` }}
    >
      {/* Мөр: нэр дээр эсвэл баруун талын сумыг дарахад дэлгэрэнгүй нээгдэнэ */}
      <div className="flex items-center gap-3 p-3 pr-3 sm:gap-4 sm:p-4">
        <button
          type="button"
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[16px] text-left sm:gap-4"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          data-testid="student-toggle"
        >
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-[16px] text-[19px] font-semibold",
              active ? "bg-brand-700 text-white shadow-[0_10px_20px_-10px_rgba(139,26,26,0.8)]" : "bg-paper-2 text-ink-500",
            )}
            aria-hidden="true"
          >
            {c.studentName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="pt-tight truncate text-[17px] font-semibold" data-testid="student-name">
                {c.studentName}
              </span>
              {c.paymentFlag === "DEBT" ? (
                <span className="size-2 shrink-0 rounded-full bg-gold-400" title="Төлбөр үлдэгдэлтэй" aria-hidden="true" />
              ) : null}
            </span>
            <span className="pt-num block truncate text-[13px] text-ink-500">
              {c.programName}
              {branches.length > 0 ? ` · ${branches.join(", ")}` : ""} ·{" "}
              <span className={low ? "font-semibold text-gold-600" : undefined}>
                {formatHours(c.remainingHours)}/{formatHours(c.totalHours)} цаг
              </span>{" "}
              · {scheduleSummary(c.classes)}
            </span>
          </span>
        </button>
        <span className="hidden items-center gap-2 sm:inline-flex">
          {categoryChips}
          <StatusBadge status={c.status} />
        </span>
        <CategoryMenu studentId={c.studentId} studentName={c.studentName} categories={categories} />
        <button
          type="button"
          onClick={onToggle}
          className="ts-chev grid size-11 shrink-0 place-items-center rounded-full border border-paper-3 bg-white text-ink-600 hover:border-brand-300"
          aria-label={open ? `${c.studentName}: хураах` : `${c.studentName}: дэлгэрэнгүй`}
          aria-expanded={open}
          aria-controls={bodyId}
        >
          <ChevronDown className="size-[18px]" aria-hidden="true" />
        </button>
      </div>

      {/* Дэлгэрэнгүй */}
      <div className="ts-body" id={bodyId}>
        <div>
          <div className="px-4 pb-5 sm:px-5">
            <div className="mb-4 h-px bg-paper-3" />
            <div className="mb-4 flex gap-2 sm:hidden">
              {categoryChips}
              <StatusBadge status={c.status} />
            </div>

            {/* Гурван үндсэн үзүүлэлт нэг эгнээнд (өргөн дэлгэц, таблет). Утсан дээр багц дээр нь, чөлөө ба төлбөр доор нь зэрэгцэнэ. */}
            <div className="ts-stats" data-testid="student-stats">
              <div className="rounded-[20px] bg-paper px-4 py-3.5">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[13px] font-medium text-ink-500">Багцын үлдэгдэл</span>
                  <span className="pt-num whitespace-nowrap" data-testid="student-remaining">
                    <span className={cn("pt-tight text-[22px] font-semibold", low && "text-brand-700")}>
                      {formatHours(c.remainingHours)}
                    </span>
                    <span className="text-[13px] font-semibold text-ink-400"> / {formatHours(c.totalHours)} цаг</span>
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-paper-3/70"
                  role="progressbar"
                  aria-label="Багцын үлдэгдэл"
                  aria-valuemin={0}
                  aria-valuemax={c.totalHours}
                  aria-valuenow={c.remainingHours}
                >
                  <div
                    className={cn("h-full rounded-full", low ? "bg-gold-400" : "bg-brand-700")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {low ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gold-600">
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {formatHours(c.remainingHours)} цаг үлдсэн, багцаа сунгах хэрэгтэй
                  </p>
                ) : null}
              </div>

              <div className="rounded-[20px] bg-paper px-4 py-3.5">
                <span className="text-[13px] font-medium text-ink-500">Чөлөөний эрх</span>
                <div className="pt-tight pt-num text-[22px] font-semibold leading-tight" data-testid="student-leaves">
                  {c.leavesLeft}
                </div>
                <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: segments }, (_, n) => (
                    <span key={n} className={cn("h-1.5 flex-1 rounded-full", n < c.leavesLeft ? "bg-brand-700" : "bg-paper-3")} />
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-paper px-4 py-3.5">
                <span className="text-[13px] font-medium text-ink-500">Төлбөр</span>
                <div className="mt-1.5" data-testid="student-payment">
                  <PaymentBadge flag={c.paymentFlag} />
                </div>
                <p className="mt-2 text-[12px] text-ink-500">
                  Эцэг эхтэй уулзсан: <b className="pt-num text-ink-900">{c.meetingsCount}</b>
                </p>
              </div>
            </div>

            {c.activePause ? (
              <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-[13px] font-medium text-gold-600">
                {c.activePause.startedOn}-аас түр зогссон
                {c.activePause.holdSeat ? " (суудал хадгалсан)" : " (суудал чөлөөлсөн)"}: {c.activePause.reason}
              </p>
            ) : null}

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-ink-500">Долоо хоногийн хуваарь</span>
                {branches.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-500">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {branches.join(", ")}
                  </span>
                ) : null}
              </div>
              {sorted.length > 0 ? (
                <>
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Хичээлийн цаг">
                    {sorted.map((cls) => {
                      const inner = (
                        <>
                          <span className="grid size-8 place-items-center rounded-[10px] border border-paper-3 bg-white text-[11.5px] font-bold text-brand-700">
                            {shortDay(cls.weekday)}
                          </span>
                          <span className="pt-num text-[14px] font-semibold">
                            {weekdayName(cls.weekday)} {cls.startTime}
                            {cls.teacherId !== userId ? (
                              <span className="font-medium text-ink-500"> · {cls.teacherName}</span>
                            ) : null}
                          </span>
                          {active ? (
                            <ArrowLeftRight className="ts-slot-icon size-3.5 text-ink-400" aria-hidden="true" />
                          ) : null}
                        </>
                      );
                      return (
                        <li key={cls.id}>
                          {active ? (
                            <button
                              type="button"
                              onClick={onTransfer}
                              className="ts-slot"
                              aria-label={`${weekdayName(cls.weekday)} ${cls.startTime}, цаг солих`}
                            >
                              {inner}
                            </button>
                          ) : (
                            <span className="ts-slot">{inner}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {active ? (
                    <p className="mt-2 text-[12px] text-ink-400">Цагийг солихын тулд цаг дээр нь дарна уу.</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-2 rounded-2xl bg-paper px-3 py-3 text-[13.5px] text-ink-400">Хуваарьт хичээл алга</p>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Link to={`/teacher/students/${c.studentId}`} className="ts-act">
                <ChartLine className="size-4" aria-hidden="true" />
                Явц, тэмдэглэл
              </Link>
              <button type="button" className="ts-act" onClick={onPlan}>
                <ListChecks className="size-4" aria-hidden="true" />
                Төлөвлөгөө
              </button>
              {active ? (
                <button type="button" className="ts-act" onClick={onTransfer}>
                  <ArrowLeftRight className="size-4" aria-hidden="true" />
                  Шилжүүлэх
                </button>
              ) : null}
              {active ? (
                <button type="button" className="ts-act" onClick={onPause}>
                  <CalendarOff className="size-4" aria-hidden="true" />
                  Урт хугацааны чөлөө
                </button>
              ) : null}
              {c.status === "PAUSED" ? (
                <button type="button" className="ts-act ts-act-primary" onClick={onResume}>
                  Үргэлжлүүлэх
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
