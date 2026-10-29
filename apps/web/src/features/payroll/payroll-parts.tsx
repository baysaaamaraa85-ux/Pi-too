import { ATTENDANCE_STATUS_LABELS, LEDGER_TYPE_LABELS, type AttendanceStatus, type LedgerRowDto, type LedgerSummaryDto } from "@pitoo/contracts";
import { formatMoney } from "@/shared/format/money";
import { Card } from "@/shared/ui/card";
import type { Column } from "@/shared/ui/data-table";
import { AttendanceStatusChip, StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

// ФШ-56, 57: олсон цалин, олгосон, үлдэгдэл. Сөрөг үлдэгдэл улаанаар БА бичвэртэй
// (утгыг зөвхөн өнгөөр дамжуулахгүй).
export function BalanceCards({ summary }: { summary: LedgerSummaryDto | undefined }) {
  const negative = summary ? Number(summary.balance) < 0 : false;
  const items = [
    { key: "earned", label: "Олсон цалин", value: summary?.earned },
    { key: "paid", label: "Олгосон", value: summary?.paid },
    { key: "balance", label: "Үлдэгдэл", value: summary?.balance },
  ];
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const isBalance = item.key === "balance";
        return (
          <Card
            key={item.key}
            className={cn("p-4", isBalance && negative && "border-danger/40 bg-danger-bg")}
            data-testid={`card-${item.key}`}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{item.label}</p>
            <p
              className={cn(
                "mt-1 text-2xl font-bold text-foreground-strong",
                isBalance && negative && "text-danger",
              )}
            >
              {item.value === undefined ? "..." : formatMoney(item.value)}
            </p>
            {isBalance && negative ? (
              <p className="mt-1 text-xs font-bold text-danger">Сөрөг үлдэгдэл: олсноосоо их авсан</p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

const TYPE_TONE = { EARNING: "success", ADJUSTMENT: "warning", PAYOUT: "info" } as const;

export function ledgerColumns(showTeacher: boolean): Column<LedgerRowDto>[] {
  const columns: Column<LedgerRowDto>[] = [
    { key: "date", header: "Огноо", cell: (r) => r.date },
  ];
  if (showTeacher) columns.push({ key: "teacher", header: "Багш", cell: (r) => r.teacherName });
  columns.push(
    { key: "branch", header: "Салбар", cell: (r) => r.branchName ?? "-" },
    { key: "class", header: "Анги", cell: (r) => r.classLabel ?? "-" },
    { key: "student", header: "Сурагч", cell: (r) => r.studentName ?? (r.note ?? "-") },
    {
      key: "status",
      header: "Төлөв",
      cell: (r) =>
        r.attendanceStatus ? (
          <AttendanceStatusChip
            status={r.attendanceStatus}
            label={ATTENDANCE_STATUS_LABELS[r.attendanceStatus as AttendanceStatus]}
          />
        ) : (
          "-"
        ),
    },
    { key: "rate", header: "Цагийн үнэлгээ", cell: (r) => (r.rateUsed ? formatMoney(r.rateUsed) : "-") },
    { key: "hours", header: "Хугацаа", cell: (r) => (r.durationHours ? `${Number(r.durationHours)} цаг` : "-") },
    {
      key: "amount",
      header: "Дүн",
      className: "text-right font-semibold",
      cell: (r) => <span data-testid="ledger-amount">{formatMoney(r.amount)}</span>,
    },
    {
      key: "type",
      header: "Төрөл",
      cell: (r) => <StatusChip tone={TYPE_TONE[r.type]}>{LEDGER_TYPE_LABELS[r.type]}</StatusChip>,
    },
  );
  return columns;
}
