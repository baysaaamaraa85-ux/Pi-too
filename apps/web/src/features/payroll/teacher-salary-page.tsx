import { ATTENDANCE_STATUS_LABELS, type AttendanceStatus, type LedgerRowDto } from "@pitoo/contracts";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { formatMoney, sumMoney } from "@/shared/format/money";
import { Card } from "@/shared/ui/card";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { AttendanceStatusChip } from "@/shared/ui/status-chip";
import { BalanceCards } from "./payroll-parts";
import { useLedger, type LedgerFilters } from "./payroll-api";

interface LessonGroup {
  key: string;
  date: string;
  label: string;
  rows: LedgerRowDto[];
  total: string;
}

// Хичээл бүрээр бүлэглэнэ (ФШ-58): тооцогдсон сурагчийн тоо, хичээлийн дүн.
function groupByLesson(rows: LedgerRowDto[]): LessonGroup[] {
  const groups = new Map<string, LessonGroup>();
  for (const row of rows) {
    const key = row.lessonId ?? `entry-${row.id}`;
    const label = row.lessonId
      ? `${row.branchName ?? ""} · ${row.classLabel ?? ""}`
      : (row.note ?? "Олголт");
    const group = groups.get(key) ?? { key, date: row.date, label, rows: [], total: "0" };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    total: sumMoney(g.rows.map((r) => r.amount)),
  }));
}

// ФШ-58: багш өөрийн цалингийн дэлгэрэнгүйг харна.
export function TeacherSalaryPage() {
  const [filters, setFilters] = React.useState<LedgerFilters>({ page: 1 });
  const ledger = useLedger(filters);
  const groups = groupByLesson(ledger.data?.items ?? []);

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

      {ledger.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {ledger.data && groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Цалингийн бичилт алга.
        </p>
      ) : null}
      <ul className="grid gap-3" data-testid="salary-groups">
        {groups.map((g) => (
          <li key={g.key}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-foreground-strong">
                  {g.date} · {g.label}
                </p>
                <p className="font-bold text-primary" data-testid="group-total">
                  {formatMoney(g.total)}
                </p>
              </div>
              <ul className="mt-2 divide-y divide-border-warm text-sm">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">
                      {r.studentName ?? r.note ?? "Олголт"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.attendanceStatus ? (
                        <AttendanceStatusChip
                          status={r.attendanceStatus}
                          label={ATTENDANCE_STATUS_LABELS[r.attendanceStatus as AttendanceStatus]}
                        />
                      ) : null}
                      <span className="font-semibold">{formatMoney(r.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
