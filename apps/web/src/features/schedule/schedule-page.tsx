import { addDaysToKey, localDateKey } from "@/shared/format/date";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { LessonActions } from "@/features/teacher/lesson-actions";
import { classLabel, useTeacherClasses } from "@/features/teacher/today-page";
import * as React from "react";
import { cn } from "@/shared/ui/utils";
import { DayGroups, LessonCard, useLessons } from "./lessons";
import { WeekSchedule } from "./week-schedule";

// Энэ сарын (Улаанбаатарын календарийн) хичээлүүд. API-ийн from, to нь UTC өдрийн эхлэл тул хоёр талд нэг өдрийн нөөцтэй
// авч, дараа нь Улаанбаатарын өдрийн түлхүүрээр сараар шүүнэ.
function useMonth() {
  const today = localDateKey(new Date());
  const monthKey = today.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = `${monthKey}-01`;
  const last = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return { monthKey, year, month, from: addDaysToKey(first, -1), to: addDaysToKey(last, 1) };
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

// D-69: үндсэн харагдац нь долоо хоногийн хуваарь гаригаар (анги, дүүргэлт, сурагчид). ФШ-23: тусдаа "Энэ сарын хичээлүүд"
// таб энэ сарын бүх хичээлийг (өнгөрсөн, удахгүй) өдрөөр харуулж, дуусаагүй хичээлийг багш цуцлах, шилжүүлэх боломжтой.
export function TeacherSchedulePage() {
  const { user } = useAuth();
  const { monthKey, year, month, from, to } = useMonth();
  const [view, setView] = React.useState<View>("week");
  // Дууссан хичээлийг цуцлах, шилжүүлэх үйлдэл харуулахгүй.
  const [now] = React.useState(() => Date.now());
  const lessons = useLessons(from, to);
  const { classes, branches } = useTeacherClasses(user!.id);
  const monthLessons = (lessons.data ?? []).filter((l) => localDateKey(l.startsAt).startsWith(monthKey));

  return (
    <>
      <PageHeader
        title="Хуваарь"
        subtitle={view === "week" ? "Долоо хоногийн хуваарь гаригаар" : `${year} оны ${month}-р сарын бүх хичээл`}
      />
      <div role="tablist" aria-label="Харагдац" className="mb-4 inline-flex gap-0.5 rounded-xl bg-background-soft p-1">
        {(
          [
            ["week", "Долоо хоногоор"],
            ["lessons", "Энэ сарын хичээлүүд"],
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
              lessons={monthLessons}
              renderLesson={(lesson) => (
                <LessonCard
                  lesson={lesson}
                  extra={classLabel(
                    classes.data?.find((c) => c.id === lesson.classId),
                    branches.data,
                  )}
                  actions={Date.parse(lesson.endsAt) > now ? <LessonActions lesson={lesson} /> : undefined}
                />
              )}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
