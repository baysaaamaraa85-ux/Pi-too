import type { MonthlyReportDto, MonthlyReportRowDto } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { formatMoney } from "@/shared/format/money";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

function currentMonth(): string {
  // Улаанбаатарын (UTC+8) одоогийн сар.
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 7);
}

const pct = (value: string | null) => (value === null ? "-" : `${value}%`);

const COLUMNS: { key: string; header: string; cell: (r: MonthlyReportRowDto) => string }[] = [
  { key: "students", header: "Идэвхтэй сурагч", cell: (r) => String(r.activeStudents) },
  {
    key: "attendance",
    header: "Ирцийн хувь",
    cell: (r) => `${pct(r.attendancePercent)} (${r.attendanceAttended}/${r.attendanceTotal})`,
  },
  { key: "payments", header: "Орсон төлбөр", cell: (r) => formatMoney(r.paymentsReceived) },
  { key: "debt", header: "Нийт өр", cell: (r) => formatMoney(r.totalDebt) },
  { key: "payroll", header: "Цалингийн зардал", cell: (r) => formatMoney(r.payrollCost) },
  {
    key: "continuation",
    header: "Багц үргэлжлүүлсэн",
    cell: (r) => `${pct(r.continuationPercent)} (${r.continuedContracts}/${r.completedContracts})`,
  },
];

// ФШ-69: салбар ба байгууллагын сарын тайлан. Байгууллагын мөр салбаруудын нийлбэр.
export function AdminReportsPage() {
  const [month, setMonth] = React.useState(currentMonth());
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const report = useQuery({
    queryKey: ["monthly-report", month],
    enabled: valid,
    queryFn: () => api.get<MonthlyReportDto>(`/reports/monthly?month=${month}`),
  });

  return (
    <>
      <PageHeader title="Тайлан" subtitle="Салбар, байгууллагын сарын үзүүлэлт" />
      <div className="mb-5 max-w-xs">
        <Field label="Сар" htmlFor="report-month">
          <Input id="report-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
      </div>

      {report.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {report.isError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          Тайланг ачаалж чадсангүй.
        </p>
      ) : null}
      {report.data ? (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-border-warm bg-surface md:block">
            <table className="w-full text-sm" data-testid="monthly-report">
              <thead className="bg-background-soft text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3">Салбар</th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="px-4 py-3">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {[...report.data.branches, report.data.total].map((row, i, all) => (
                  <tr
                    key={row.branchId ?? row.branchName}
                    className={cn(i === all.length - 1 && "bg-background-soft font-bold")}
                    data-testid={i === all.length - 1 ? "report-total" : "report-branch"}
                  >
                    <td className="px-4 py-3">{row.branchName}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {[...report.data.branches, report.data.total].map((row, i, all) => (
              <div
                key={row.branchId ?? row.branchName}
                className={cn(
                  "rounded-2xl border border-border-warm bg-surface p-4",
                  i === all.length - 1 && "border-primary",
                )}
              >
                <h3 className="font-bold text-foreground-strong">{row.branchName}</h3>
                <dl className="mt-2 grid gap-1 text-sm">
                  {COLUMNS.map((c) => (
                    <div key={c.key} className="flex justify-between gap-3">
                      <dt className="text-muted">{c.header}</dt>
                      <dd className="text-right font-semibold">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Ирцийн хувь = ирсэн (Ирсэн, Нөхөлт, Үнэгүй давтлага) / нийт ирц. Нийт өр нь одоогийн
            байдлаар. Сурагч, төлбөр, өр нь сурагчийн хамгийн сүүлийн бүртгэлийн салбарт, ирц ба
            цалин нь хичээлийн салбарт тооцогдоно.
          </p>
        </>
      ) : null}
    </>
  );
}
