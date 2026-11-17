import { addDaysToKey, localDateKey } from "@/shared/format/date";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { LessonActions } from "@/features/teacher/lesson-actions";
import { classLabel, useTeacherClasses } from "@/features/teacher/today-page";
import * as React from "react";
import { cn } from "@/shared/ui/utils";
import { DayGroups, LessonCard, useLessons } from "./lessons";
import { WeekSchedule } from "./week-schedule";

function useRange() {
  const today = localDateKey(new Date());
  return { from: addDaysToKey(today, -1), to: addDaysToKey(today, 29), today };
}

function Loading({ query }: { query: { isLoading: boolean; isError: boolean } }) {
  if (query.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        Хуваарийг ачаалж чадсангүй.
      </p>
    );
  return null;
}

type View = "week" | "lessons";

// D-69: үндсэн харагдац нь долоо хоногийн хуваарь гаригаар (анги, дүүргэлт, сурагчид). ФШ-23: тусдаа "Хичээлүүд"
// таб дараагийн 4 долоо хоногийн хичээлийг харуулж, багш цуцлах, шилжүүлэх боломжтой.
export function TeacherSchedulePage() {
  const { user } = useAuth();
  const { from, to, today } = useRange();
  const [view, setView] = React.useState<View>("week");
  const lessons = useLessons(from, to);
  const { classes, branches } = useTeacherClasses(user!.id);
  const upcoming = (lessons.data ?? []).filter((l) => localDateKey(l.startsAt) >= today);

  return (
    <>
      <PageHeader
        title="Хуваарь"
        subtitle={view === "week" ? "Долоо хоногийн хуваарь гаригаар" : "Дараагийн 4 долоо хоногийн хичээл"}
      />
      <div role="tablist" aria-label="Харагдац" className="mb-4 inline-flex gap-0.5 rounded-xl bg-background-soft p-1">
        {(
          [
            ["week", "Долоо хоногоор"],
            ["lessons", "Ирэх хичээлүүд"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "min-h-11 rounded-lg px-4 text-sm font-semibold transition-colors",
              view === key ? "bg-primary text-primary-foreground shadow-soft" : "text-mid hover:text-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "week" ? <WeekSchedule /> : null}
      {view === "lessons" ? (
        <>
          <Loading query={lessons} />
          {lessons.data ? (
            <DayGroups
              lessons={upcoming}
              renderLesson={(lesson) => (
                <LessonCard
                  lesson={lesson}
                  extra={classLabel(
                    classes.data?.find((c) => c.id === lesson.classId),
                    branches.data,
                  )}
                  actions={<LessonActions lesson={lesson} />}
                />
              )}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
