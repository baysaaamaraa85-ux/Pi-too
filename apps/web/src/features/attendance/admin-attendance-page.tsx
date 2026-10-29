import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { useBranches } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatTime, localDateKey } from "@/shared/format/date";
import { Card } from "@/shared/ui/card";
import { Field, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { StatusChip } from "@/shared/ui/status-chip";

interface DayLesson {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  branchName: string;
  teacherName: string;
  expected: number;
  recorded: number;
}

// Шинэ шаардлага 1.5: админ бүх ангийн ирцийг нэг дэлгэцээр бүртгэнэ, засна.
export function AdminAttendancePage() {
  const [date, setDate] = React.useState(localDateKey(new Date()));
  const [branchId, setBranchId] = React.useState("");
  const branches = useBranches();
  const params = new URLSearchParams({ date });
  if (branchId) params.set("branchId", branchId);
  const lessons = useQuery({
    queryKey: ["attendance-day", params.toString()],
    queryFn: () => api.get<DayLesson[]>(`/attendance/lessons?${params.toString()}`),
  });

  return (
    <>
      <PageHeader title="Ирц" subtitle="Өдрийн хичээлүүд, ирц бөглөгдсөн эсэх" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[200px_240px]">
        <Field label="Огноо" htmlFor="att-date">
          <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Салбар" htmlFor="att-branch">
          <Select id="att-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Бүх салбар</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {lessons.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {lessons.data?.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Энэ өдөр хичээл алга.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {lessons.data?.map((l) => {
          const missing = l.status !== "CANCELLED" && l.recorded === 0 && l.expected > 0 && new Date(l.startsAt) <= new Date();
          return (
            <li key={l.id}>
              <Link to={`/admin/attendance/${l.id}`} data-testid="day-lesson">
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-primary/25">
                  <div>
                    <p className="font-bold text-foreground-strong">
                      {formatTime(l.startsAt)} - {formatTime(l.endsAt)} · {l.branchName}
                    </p>
                    <p className="text-sm text-muted">{l.teacherName}</p>
                  </div>
                  {l.status === "CANCELLED" ? (
                    <StatusChip tone="danger">Цуцлагдсан</StatusChip>
                  ) : missing ? (
                    <StatusChip tone="danger">Ирц бөглөөгүй</StatusChip>
                  ) : (
                    <StatusChip tone={l.recorded > 0 ? "success" : "neutral"}>
                      Бүртгэсэн {l.recorded}/{l.expected}
                    </StatusChip>
                  )}
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
