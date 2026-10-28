import { LESSON_STATUS_LABELS, type LessonStatus } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { api } from "@/shared/api-client/client";
import type { LessonDto } from "@/shared/api-client/types";
import { formatDate, formatTime, localDateKey, weekdayName, weekdayOf } from "@/shared/format/date";
import { Card } from "@/shared/ui/card";
import { StatusChip, type ChipTone } from "@/shared/ui/status-chip";

const LESSON_TONE: Record<LessonStatus, ChipTone> = {
  SCHEDULED: "neutral",
  CANCELLED: "danger",
  RESCHEDULED: "warning",
};

export function useLessons(fromKey: string, toKey: string) {
  return useQuery({
    queryKey: ["lessons", fromKey, toKey],
    queryFn: () => api.get<LessonDto[]>(`/lessons?from=${fromKey}&to=${toKey}`),
  });
}

export function LessonStatusChip({ status }: { status: LessonStatus }) {
  return <StatusChip tone={LESSON_TONE[status]}>{LESSON_STATUS_LABELS[status]}</StatusChip>;
}

export function LessonCard({
  lesson,
  extra,
  actions,
}: {
  lesson: LessonDto;
  extra?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent/16 text-primary">
            <Clock className="size-5" />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight text-foreground-strong">
              {formatTime(lesson.startsAt)} - {formatTime(lesson.endsAt)}
            </p>
            {extra ? <p className="text-[0.82rem] text-muted">{extra}</p> : null}
          </div>
        </div>
        <LessonStatusChip status={lesson.status} />
      </div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </Card>
  );
}

// Хичээлүүдийг Улаанбаатарын өдрөөр бүлэглэж харуулна.
export function DayGroups({
  lessons,
  renderLesson,
}: {
  lessons: LessonDto[];
  renderLesson: (lesson: LessonDto) => React.ReactNode;
}) {
  const groups = new Map<string, LessonDto[]>();
  for (const lesson of lessons) {
    const key = localDateKey(lesson.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), lesson]);
  }
  const keys = [...groups.keys()].sort();

  if (keys.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        Энэ хугацаанд хичээл алга байна.
      </p>
    );
  }

  return (
    <div className="grid gap-7">
      {keys.map((key) => {
        const first = groups.get(key)![0]!;
        return (
          <section key={key}>
            <h2 className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-muted after:h-px after:flex-1 after:bg-border-warm">
              {weekdayName(weekdayOf(first.startsAt))} · {formatDate(first.startsAt)}
            </h2>
            <div className="grid gap-3">
              {groups.get(key)!.map((lesson) => (
                <div key={lesson.id}>{renderLesson(lesson)}</div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
