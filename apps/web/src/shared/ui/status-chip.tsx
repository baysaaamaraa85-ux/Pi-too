import { cn } from "./utils";

export type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClasses: Record<ChipTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-background-soft text-muted",
};

export function StatusChip({ tone, children }: { tone: ChipTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

// ФШ-26, CLAUDE.md 6.4: ирцийн таван төлөв тус бүр өнгө ба бичвэртэй
// (WCAG 1.4.1 - утгыг зөвхөн өнгөөр дамжуулахгүй, бичвэр үргэлж хамт байна).
const ATTENDANCE_TONE: Record<string, ChipTone> = {
  PRESENT: "success",
  EXCUSED: "warning",
  OVER_LIMIT: "danger",
  MAKEUP: "info",
  FREE_REVIEW: "neutral",
};

export function AttendanceStatusChip({ status, label }: { status: string; label: string }) {
  return <StatusChip tone={ATTENDANCE_TONE[status] ?? "neutral"}>{label}</StatusChip>;
}
