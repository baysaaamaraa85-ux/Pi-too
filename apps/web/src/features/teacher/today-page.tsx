import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { api } from "@/shared/api-client/client";
import type { BranchDto, ClassDto } from "@/shared/api-client/types";
import { addDaysToKey, formatDate, localDateKey, weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { DayGroups, LessonCard, useLessons } from "@/features/schedule/lessons";
import { TeacherDashboardSections } from "@/features/dashboard/teacher-dashboard";
import { LessonActions } from "./lesson-actions";

export function useTeacherClasses(teacherId: string) {
  const classes = useQuery({
    queryKey: ["classes", teacherId],
    queryFn: () => api.get<ClassDto[]>(`/classes?teacherId=${teacherId}`),
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<BranchDto[]>("/branches"),
  });
  return { classes, branches };
}

export function classLabel(
  cls: ClassDto | undefined,
  branches: BranchDto[] | undefined,
): string | undefined {
  if (!cls) return undefined;
  const branch = branches?.find((b) => b.id === cls.branchId)?.name;
  return `${branch ?? "Салбар"} · ${weekdayName(cls.weekday)} ${cls.startTime}`;
}

// ФШ-69: багшийн нүүр. Өнөөдрийн хичээлүүд (Улаанбаатарын өдрөөр).
export function TeacherTodayPage() {
  const { user } = useAuth();
  const today = localDateKey(new Date());
  // UTC ба Улаанбаатарын өдөр зөрдөг тул өргөн хүрээ авч, өдрөөр нь шүүнэ.
  const lessons = useLessons(addDaysToKey(today, -1), addDaysToKey(today, 2));
  const { classes, branches } = useTeacherClasses(user!.id);

  const todays = (lessons.data ?? []).filter((l) => localDateKey(l.startsAt) === today);

  return (
    <>
      <PageHeader
        title="Өнөөдөр"
        subtitle={`${weekdayName(new Date(`${today}T00:00:00Z`).getUTCDay() || 7)} · ${formatDate(new Date())}`}
      />
      <TeacherDashboardSections />
      {lessons.isLoading ? (
        <p className="text-sm text-muted">Ачаалж байна...</p>
      ) : lessons.isError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          Хичээлийн жагсаалтыг ачаалж чадсангүй.
        </p>
      ) : (
        <DayGroups
          lessons={todays}
          renderLesson={(lesson) => (
            <LessonCard
              lesson={lesson}
              extra={classLabel(
                classes.data?.find((c) => c.id === lesson.classId),
                branches.data,
              )}
              actions={
                <>
                  {lesson.status === "SCHEDULED" ? (
                    <Button asChild>
                      <Link to={`/teacher/attendance/${lesson.id}`}>Ирц бүртгэх</Link>
                    </Button>
                  ) : null}
                  <LessonActions lesson={lesson} />
                </>
              }
            />
          )}
        />
      )}
    </>
  );
}
