import type {
  DashboardLessonDto,
  TeacherCategoryDto,
  TeacherTaskDto,
} from "@pitoo/contracts";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  LayoutGrid,
  PercentCircle,
  UserPlus,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { PushEnableCard } from "@/features/notifications/push-card";
import { ProgressPanel } from "@/features/progress/progress-trend";
import { formatDate, formatTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { DashHeader, PanelTitle, StatCard, panelClass } from "@/shared/ui/dash";
import { StatusChip } from "@/shared/ui/status-chip";
import { useTeacherDashboard } from "./dashboard-api";

const panel = panelClass;

// ---- Категори: багш сурагчдаа хөтөлбөрөөр хуваасан байдал
function Categories({ categories }: { categories: TeacherCategoryDto[] }) {
  const total = categories.reduce((s, c) => s + c.students, 0);
  return (
    <section className={panel} aria-labelledby="cat-title" data-testid="categories">
      <PanelTitle icon={LayoutGrid}>
        <span id="cat-title">Категори</span>
      </PanelTitle>
      <ul className="grid gap-1.5">
        <li className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 text-sm font-semibold text-primary">
          <span>Бүгд</span>
          <span data-testid="category-total">{total}</span>
        </li>
        {categories.map((c) => (
          <li
            key={c.categoryId ?? "none"}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border-warm bg-background-soft/50 px-3 text-sm text-mid"
            data-testid="category-row"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="font-semibold text-foreground-strong">{c.students}</span>
          </li>
        ))}
        {categories.length === 0 ? <li className="px-3 py-2 text-sm text-muted">Идэвхтэй сурагч алга.</li> : null}
        <li className="px-1 pt-1">
          <Link to="/teacher/students" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            Категори нэмэх, засах
          </Link>
        </li>
      </ul>
    </section>
  );
}

// Өнөөдрийн хичээл ба ирц бөглөөгүй хичээл (ФШ-70) нэг жагсаалтад: бөглөөгүй нь дээд талд, улаан тэмдэглэгээтэй.
// Ирц хадгалмагц бөглөөгүй мөр тэр дороо арилна.
function TodayLessons({ lessons, unfilled }: { lessons: DashboardLessonDto[]; unfilled: DashboardLessonDto[] }) {
  const unfilledIds = new Set(unfilled.map((l) => l.id));
  const today = lessons.filter((l) => !unfilledIds.has(l.id));
  const empty = today.length === 0 && unfilled.length === 0;
  return (
    <section className={panel} aria-labelledby="today-title" data-testid="today-lessons">
      <PanelTitle
        icon={CalendarDays}
        action={
          <Link to="/teacher/calendar" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Бүгдийг харах <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <span id="today-title">Өнөөдрийн хичээл</span>
      </PanelTitle>
      {empty ? (
        <p className="rounded-xl bg-background-soft px-5 py-6 text-center text-sm text-muted">Өнөөдөр хичээл алга.</p>
      ) : (
        <div className="grid gap-2">
          {unfilled.length > 0 ? (
            <ul className="grid gap-2" data-testid="unfilled-lessons" aria-label="Ирц бөглөөгүй хичээл">
              {unfilled.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/6 p-2.5"
                  data-testid="unfilled-lesson"
                >
                  <span className="rounded-lg bg-primary/10 px-3 py-2.5 text-[0.8125rem] font-bold text-primary">
                    {formatDate(lesson.startsAt)} {formatTime(lesson.startsAt)}
                  </span>
                  <div className="min-w-[8rem] flex-1">
                    <p className="text-sm font-semibold text-foreground-strong">{lesson.branchName}</p>
                    <p className="text-[0.8125rem] text-danger">Ирц бөглөөгүй · {lesson.expected} сурагч</p>
                  </div>
                  <Button asChild className="w-full rounded-lg sm:w-auto">
                    <Link to={`/teacher/attendance/${lesson.id}`}>Ирц бүртгэх</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          {today.length > 0 ? (
            <ul className="grid gap-2">
              {today.map((lesson) => {
                const done = lesson.expected > 0 && lesson.recorded >= lesson.expected;
                return (
                  <li
                    key={lesson.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border-warm bg-background-soft/60 p-2.5"
                    data-testid="today-lesson"
                  >
                    <span className="rounded-lg bg-primary/8 px-3 py-2.5 text-[0.8125rem] font-bold text-primary">
                      {formatTime(lesson.startsAt)} - {formatTime(lesson.endsAt)}
                    </span>
                    <div className="min-w-[8rem] flex-1">
                      <p className="text-sm font-semibold text-foreground-strong">{lesson.branchName}</p>
                      <p className="text-[0.8125rem] text-muted">{lesson.expected} сурагч</p>
                    </div>
                    {lesson.status === "CANCELLED" ? (
                      <StatusChip tone="neutral">Цуцлагдсан</StatusChip>
                    ) : done ? (
                      <StatusChip tone="success">Ирц бөглөсөн</StatusChip>
                    ) : (
                      <Button asChild className="w-full rounded-lg sm:w-auto">
                        <Link to={`/teacher/attendance/${lesson.id}`}>Ирц бүртгэх</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

const ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/teacher/enroll", label: "Сурагч бүртгэх", icon: UserPlus },
  { to: "/teacher/classes", label: "Анги нэмэх", icon: CalendarPlus },
  { to: "/teacher/students", label: "Сорил бүртгэх", icon: BookOpenCheck },
  { to: "/teacher/salary", label: "Цалин харах", icon: Wallet },
];

function QuickActions() {
  return (
    <section className={panel} aria-labelledby="actions-title">
      <PanelTitle icon={Zap}>
        <span id="actions-title">Шуурхай үйлдлүүд</span>
      </PanelTitle>
      <ul className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <li key={a.to}>
            <Link
              to={a.to}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-border-warm bg-background-soft/60 px-2.5 text-sm font-medium leading-tight text-mid transition-colors hover:border-primary/30 hover:text-primary"
            >
              <a.icon className="size-4 shrink-0 text-primary" />
              <span className="flex-1">{a.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reminders({ tasks }: { tasks: TeacherTaskDto[] }) {
  if (tasks.length === 0) return null;
  return (
    <section className={panel} aria-labelledby="tasks-title" data-testid="teacher-tasks">
      <PanelTitle icon={ClipboardList}>
        <span id="tasks-title">Сануулга ({tasks.length})</span>
      </PanelTitle>
      <ul className="grid gap-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background-soft/60 p-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground-strong">{task.studentName}</p>
              <p className="text-xs text-muted">
                {task.programName} · {formatDate(task.dueOn)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone={task.type === "MEETING" ? "warning" : "info"}>
                {task.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт"}
              </StatusChip>
              <Button variant="secondary" size="sm" className="rounded-lg" asChild>
                <Link to={`/teacher/students/${task.studentId}`}>Нээх</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Багшийн нүүр: баннер, дөрвөн үзүүлэлт, зүүн талд хичээл ба ахиц, баруун талд анхаарах зүйл, шуурхай үйлдэл, категори (ФШ-43, 70).
export function TeacherHome() {
  const dash = useTeacherDashboard();
  const d = dash.data;

  return (
    <>
      <DashHeader
        title={d?.teacherName ? `${d.teacherName} багшдаа` : "Сайн байна уу"}
        subtitle="Өнөөдрийн ажилд нь амжилт хүсье!"
        aside={
          <Button asChild variant="secondary" className="rounded-xl">
            <Link to="/teacher/profile">Миний профайл</Link>
          </Button>
        }
      />
      <PushEnableCard />

      {d && d.unratedStudents.length > 0 ? (
        <div
          role="status"
          data-testid="unrated-notice"
          className="mb-4 flex flex-wrap items-center gap-x-3 rounded-xl bg-warning-bg px-4 py-2 text-sm font-semibold text-warning"
        >
          <span>
            {d.unratedStudents.length} сурагчид цагийн үнэлгээ оруулаагүй байна. Оруулаагүй хүүхдийн цалин 0 ₮ бодогдоно.
          </span>
          <Link
            to={`/teacher/students/${d.unratedStudents[0]!.studentId}`}
            className="inline-flex min-h-11 items-center underline"
          >
            Үнэлгээ оруулах
          </Link>
        </div>
      ) : null}

      {dash.isError ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          Самбарыг ачаалж чадсангүй.
        </p>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="teacher-stats">
        <StatCard testId="stat-students" icon={Users} value={d?.stats.students ?? "-"} label="Нийт сурагчид" />
        <StatCard testId="stat-lessons" icon={CalendarDays} value={d?.stats.lessonsThisMonth ?? "-"} label="Энэ сарын хичээл" />
        <StatCard
          testId="stat-attendance"
          icon={PercentCircle}
          value={d ? (d.stats.attendancePercent === null ? "-" : `${Number(d.stats.attendancePercent)}%`) : "-"}
          label="Энэ сарын ирц"
        />
        <StatCard
          testId="stat-unfilled"
          icon={ClipboardList}
          tone={d && d.unfilledLessons.length > 0 ? "danger" : "primary"}
          value={d?.unfilledLessons.length ?? "-"}
          label="Ирц бөглөөгүй хичээл"
        />
      </div>

      {/* Утсанд нэг багана (order), lg-ээс хоёр багана: зүүн хичээл, ахиц | баруун анхаарах, үйлдэл, категори */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="contents min-w-0 lg:grid lg:content-start lg:gap-4">
          <div className="min-w-0 order-2">
            <TodayLessons lessons={d?.todayLessons ?? []} unfilled={d?.unfilledLessons ?? []} />
          </div>
          <div className="min-w-0 order-6">
            <ProgressPanel points={d?.progress ?? []} />
          </div>
        </div>
        <div className="contents min-w-0 lg:grid lg:content-start lg:gap-4">
          <div className="min-w-0 order-3">
            <QuickActions />
          </div>
          <div className="min-w-0 order-4">
            <Categories categories={d?.categories ?? []} />
          </div>
          <div className="min-w-0 order-5 empty:hidden">
            <Reminders tasks={d?.tasks ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}
