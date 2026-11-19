import type { ClassRosterDto, ClassWeekDto } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { api } from "@/shared/api-client/client";
import { WEEKDAY_NAMES } from "@/shared/format/date";
import { weekdayAccent, weekdayCardStyle } from "@/shared/format/weekday-color";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

export function useWeekClasses() {
  return useQuery({ queryKey: ["week-classes"], queryFn: () => api.get<ClassWeekDto[]>("/classes/week") });
}

function RosterModal({ cls, onClose }: { cls: ClassWeekDto; onClose: () => void }) {
  const roster = useQuery({
    queryKey: ["class-roster", cls.id],
    queryFn: () => api.get<ClassRosterDto>(`/classes/${cls.id}/students`),
  });
  const students = roster.data?.students ?? [];
  return (
    <Modal
      open
      title={`${WEEKDAY_NAMES[cls.weekday - 1]} ${cls.startTime} - ${cls.endTime}`}
      description={`${cls.branchName} · ${cls.enrolled}/${cls.capacity} суудал`}
      onClose={onClose}
    >
      {roster.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {roster.data && students.length === 0 ? <p className="text-sm text-muted">Ангид сурагч бүртгэлгүй байна.</p> : null}
      <ul className="grid max-h-[60vh] gap-2 overflow-y-auto" data-testid="roster-list">
        {students.map((s) => (
          <li key={s.contractId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-warm px-3.5 py-2.5" data-testid="roster-student">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-foreground-strong">{s.studentName}</span>
              <span className="block text-xs text-muted">{s.programName}</span>
              {/* D-97: сурагчийн сургууль */}
              <span className="block truncate text-xs text-muted" data-testid="roster-school">
                {s.school ?? "Сургууль бүртгээгүй"}
              </span>
            </span>
            <StatusChip tone={s.paymentFlag === "DEBT" ? "warning" : "success"}>
              {s.paymentFlag === "DEBT" ? "Төлөгдөөгүй" : "Төлөгдсөн"}
            </StatusChip>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// D-69: долоо хоногийн хуваарь гаригаар. Гариг бүрт цагийн дарааллаар анги, дүүргэлт (бүртгэлтэй/суудал).
// Дарахад ангийн сурагчид төлбөрийн төлөвтэй нь popup-д гарна.
export function WeekSchedule() {
  const classes = useWeekClasses();
  const [open, setOpen] = React.useState<ClassWeekDto | null>(null);
  const byDay = WEEKDAY_NAMES.map((name, i) => ({
    name,
    weekday: i + 1,
    list: (classes.data ?? []).filter((c) => c.weekday === i + 1),
  }));

  if (classes.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (classes.isError) {
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        Хуваарийг ачаалж чадсангүй.
      </p>
    );
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7" data-testid="week-schedule">
        {byDay.map((day) => (
          <section key={day.name} aria-label={day.name} className="min-w-0 rounded-2xl border border-border-warm bg-surface p-3 shadow-soft" data-testid="week-day">
            <h2 className="mb-2 flex items-center justify-between font-display text-base font-bold text-foreground-strong">
              <span className="inline-flex items-center gap-2">
                {/* D-100: гараг бүр өөр өнгөтэй, ангийн карт ижил өнгөөр тодорно */}
                <span className="size-3 rounded-full" style={{ backgroundColor: weekdayAccent(day.weekday) }} aria-hidden="true" />
                {day.name}
              </span>
              <span className="text-xs font-semibold text-muted">{day.list.length}</span>
            </h2>
            {day.list.length === 0 ? <p className="rounded-xl bg-background-soft px-3 py-4 text-center text-xs text-muted">Анги алга</p> : null}
            <ul className="grid gap-2">
              {day.list.map((c) => {
                const full = c.enrolled >= c.capacity;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(c)}
                      data-testid="week-class"
                      style={weekdayCardStyle(c.weekday)}
                      className="grid min-h-11 w-full gap-1 rounded-xl border px-3 py-2 text-left transition hover:shadow-soft hover:brightness-[0.97]"
                    >
                      <span className="font-bold tabular-nums text-foreground-strong">
                        {c.startTime} - {c.endTime}
                      </span>
                      <span className="truncate text-xs text-muted">{c.branchName}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/12" aria-hidden="true">
                          <span
                            className={cn("block h-full rounded-full", full && "bg-warning")}
                            style={{
                              width: `${Math.min(100, (c.enrolled / Math.max(1, c.capacity)) * 100)}%`,
                              ...(full ? {} : { backgroundColor: weekdayAccent(c.weekday) }),
                            }}
                          />
                        </span>
                        <span className="text-xs font-bold tabular-nums text-foreground-strong" data-testid="week-fill">
                          {c.enrolled}/{c.capacity}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {open ? <RosterModal cls={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
