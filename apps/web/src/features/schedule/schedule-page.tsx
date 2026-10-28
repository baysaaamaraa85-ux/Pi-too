import { addDaysToKey, localDateKey } from "@/shared/format/date";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { LessonActions } from "@/features/teacher/lesson-actions";
import { classLabel, useTeacherClasses } from "@/features/teacher/today-page";
import { DayGroups, LessonCard, useLessons } from "./lessons";

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

// ФШ-23: дараагийн 4 долоо хоногийн хичээл. Багш цуцлах, шилжүүлэх боломжтой.
export function TeacherSchedulePage() {
  const { user } = useAuth();
  const { from, to, today } = useRange();
  const lessons = useLessons(from, to);
  const { classes, branches } = useTeacherClasses(user!.id);
  const upcoming = (lessons.data ?? []).filter((l) => localDateKey(l.startsAt) >= today);

  return (
    <>
      <PageHeader title="Хуваарь" subtitle="Дараагийн 4 долоо хоногийн хичээл" />
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
  );
}
