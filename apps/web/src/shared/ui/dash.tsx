import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { formatDate, weekdayName, weekdayOf } from "../format/date";
import { cn } from "./utils";

// Бүх dashboard-ын нийтлэг загвар: цагаан панел, нимгэн хүрээ, зөөлөн сүүдэр, serif гарчиг,
// Inter-ийн тод тоо. Үүрэг бүр (админ, багш, эцэг эх, сурагч) энэ хэсгүүдийг л ашиглана.

export const panelClass = "rounded-2xl border border-border-warm bg-surface p-4 shadow-soft sm:p-5";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children: React.ReactNode }) {
  return (
    <section className={cn(panelClass, className)} {...props}>
      {children}
    </section>
  );
}

export function PanelTitle({
  icon: Icon,
  children,
  action,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground-strong">
        {Icon ? <Icon className="size-[18px] text-primary" aria-hidden="true" /> : null}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  value,
  label,
  hint,
  hintTone,
  testId,
  valueTestId,
  tone = "primary",
  to,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
  hintTone?: "danger" | "muted";
  testId?: string;
  valueTestId?: string;
  tone?: "primary" | "danger" | "warning";
  to?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl sm:size-11",
          tone === "danger" && "bg-danger-bg text-danger",
          tone === "warning" && "bg-warning-bg text-warning",
          tone === "primary" && "bg-primary/8 text-primary",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="mb-1 text-[0.8125rem] leading-snug text-muted">{label}</p>
        <p
          className="text-2xl font-extrabold leading-none tracking-tight text-foreground-strong tabular-nums"
          data-testid={valueTestId}
        >
          {value}
        </p>
        {hint ? (
          <p className={cn("mt-1 text-[0.8125rem] font-semibold leading-tight", hintTone === "danger" ? "text-danger" : "text-muted")}>
            {hint}
          </p>
        ) : null}
      </div>
    </>
  );
  const cls =
    "relative z-20 flex flex-col items-start gap-2.5 rounded-2xl border border-border-warm bg-surface p-3.5 shadow-soft sm:flex-row sm:items-center sm:gap-3.5";
  if (to) {
    return (
      <Link to={to} className={cn(cls, "transition-colors hover:border-primary/30")} data-testid={testId}>
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

// Бүх самбарын нэг толгой: гарчиг, тайлбар, баруун талд нэмэлт зүйл. Чимэглэл, эможи байхгүй.
export function DashHeader({
  title,
  subtitle,
  aside,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <header className="relative z-10 mb-4 flex flex-wrap items-start justify-between gap-3 pt-1 md:pt-2">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(1.7rem,2.7vw,2.5rem)] font-black leading-tight text-foreground-strong">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-mid">{subtitle}</p> : null}
      </div>
      {aside}
    </header>
  );
}

// Өнөөдрийн огноо, гараг: "2026.11.12, Пүрэв".
export function DateChip() {
  const now = new Date();
  return (
    <span className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-2xl border border-border-warm bg-white/80 px-4 text-sm font-semibold text-mid shadow-soft">
      <CalendarDays className="size-4 text-primary" />
      {formatDate(now)}, {weekdayName(weekdayOf(now))}
    </span>
  );
}
