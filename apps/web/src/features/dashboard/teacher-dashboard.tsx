import { Link } from "react-router";
import { formatDate, formatTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { StatusChip } from "@/shared/ui/status-chip";
import { useTeacherDashboard } from "./dashboard-api";

// ФШ-70: багшийн нүүр. Ирц бөглөөгүй хичээл ба эцэг эхтэй уулзах сануулга. Ирц хадгалмагц
// хичээл жагсаалтаас тэр дороо гарна (ирцийн хуудас ["dashboard"]-ыг шинэчилнэ).
export function TeacherDashboardSections() {
  const dash = useTeacherDashboard();
  const unfilled = dash.data?.unfilledLessons ?? [];
  const tasks = dash.data?.tasks ?? [];
  if (unfilled.length === 0 && tasks.length === 0) return null;

  return (
    <div className="mb-8 grid gap-6">
      {unfilled.length > 0 ? (
        <section aria-labelledby="unfilled-title" data-testid="unfilled-lessons">
          <h2
            id="unfilled-title"
            className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-danger"
          >
            Ирц бөглөөгүй хичээл ({unfilled.length})
          </h2>
          <div className="grid gap-2">
            {unfilled.map((lesson) => (
              <Card
                key={lesson.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
                data-testid="unfilled-lesson"
              >
                <div>
                  <p className="font-semibold text-foreground-strong">
                    {formatDate(lesson.startsAt)} · {formatTime(lesson.startsAt)}
                  </p>
                  <p className="text-[0.82rem] text-muted">
                    {lesson.branchName} · {lesson.expected} сурагч
                  </p>
                </div>
                <Button asChild>
                  <Link to={`/teacher/attendance/${lesson.id}`}>Ирц бүртгэх</Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {tasks.length > 0 ? (
        <section aria-labelledby="tasks-title" data-testid="teacher-tasks">
          <h2 id="tasks-title" className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
            Сануулга ({tasks.length})
          </h2>
          <div className="grid gap-2">
            {tasks.map((task) => (
              <Card key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-foreground-strong">{task.studentName}</p>
                  <p className="text-[0.82rem] text-muted">
                    {task.programName} · {formatDate(task.dueOn)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip tone={task.type === "MEETING" ? "warning" : "info"}>
                    {task.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт"}
                  </StatusChip>
                  <Button variant="secondary" asChild>
                    <Link to={`/teacher/students/${task.studentId}`}>Нээх</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
