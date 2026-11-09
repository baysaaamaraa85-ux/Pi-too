import type { DashboardLessonDto, TeacherProgressPointDto, TeacherTaskDto } from "@pitoo/contracts";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  PercentCircle,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { PushEnableCard } from "@/features/notifications/push-card";
import { formatDate, formatTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useTeacherDashboard } from "./dashboard-api";

const panel = "rounded-3xl border border-border-warm bg-surface p-5 shadow-md sm:p-6";

function PanelTitle({ icon: Icon, children, action }: { icon: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2.5 font-display text-xl font-bold text-foreground-strong">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/8 text-primary">
          <Icon className="size-[18px]" />
        </span>
        {children}
      </h2>
      {action}
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  testId,
  tone = "primary",
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  testId: string;
  tone?: "primary" | "danger";
}) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-3xl border border-border-warm bg-surface p-4 shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-5"
      data-testid={testId}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-2xl sm:size-14",
          tone === "danger" ? "bg-danger-bg text-danger" : "bg-primary/8 text-primary",
        )}
      >
        <Icon className="size-5 sm:size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-[1.75rem] font-extrabold leading-none tracking-tight text-foreground-strong tabular-nums">{value}</p>
        <p className="mt-1.5 text-[0.82rem] text-muted">{label}</p>
      </div>
    </div>
  );
}

function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}-р сар`;
}

// Сурагчдын ахиц: сорил, шалгалтын сарын дундаж дүн (%). Цэг бүрийн хувь бичвэрээр (өнгөөр ялгахгүй).
export function ProgressTrend({ points }: { points: TeacherProgressPointDto[] }) {
  const id = React.useId().replace(/:/g, "");
  const width = 560;
  const height = 230;
  const pad = { left: 36, right: 24, top: 28, bottom: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const inset = 28;
  const x = (i: number) =>
    pad.left + (points.length <= 1 ? innerW / 2 : inset + (i / (points.length - 1)) * (innerW - 2 * inset));
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const coords = points.map((p, i) => [x(i), y(Number(p.averagePercent))] as const);
  const line = coords.map(([cx, cy]) => `${cx},${cy}`).join(" ");
  const area = coords.length
    ? `${pad.left},${pad.top + innerH} ${line} ${coords[coords.length - 1]![0]},${pad.top + innerH}`
    : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Сурагчдын дундаж ахиц: ${points.map((p) => `${monthLabel(p.month)} ${p.averagePercent}%`).join(", ")}`}
      className="h-auto w-full"
      data-testid="trend-chart"
    >
      <defs>
        <linearGradient id={`area-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeDasharray="3 5" />
          <text x={pad.left - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
            {g}
          </text>
        </g>
      ))}
      {points.length > 1 ? <polygon points={area} fill={`url(#area-${id})`} /> : null}
      <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
      {points.map((p, i) => (
        <g key={p.month} data-testid="trend-point">
          <circle cx={coords[i]![0]} cy={coords[i]![1]} r="5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2.5" />
          <text x={coords[i]![0]} y={coords[i]![1] - 13} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-primary)">
            {Number(p.averagePercent)}%
          </text>
          <text x={coords[i]![0]} y={height - 10} textAnchor="middle" fontSize="12" fill="var(--color-mid)">
            {monthLabel(p.month)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function TodayLessons({ lessons }: { lessons: DashboardLessonDto[] }) {
  return (
    <section className={panel} aria-labelledby="today-title" data-testid="today-lessons">
      <PanelTitle
        icon={CalendarDays}
        action={
          <Link to="/teacher/calendar" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Бүгдийг харах <ArrowRight className="size-4" />
          </Link>
        }
      >
        <span id="today-title">Өнөөдрийн хичээл</span>
      </PanelTitle>
      {lessons.length === 0 ? (
        <p className="rounded-2xl bg-background-soft px-5 py-8 text-center text-sm text-muted">Өнөөдөр хичээл алга.</p>
      ) : (
        <ul className="grid gap-3">
          {lessons.map((lesson) => {
            const done = lesson.expected > 0 && lesson.recorded >= lesson.expected;
            return (
              <li
                key={lesson.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-warm bg-background-soft/60 p-3.5"
                data-testid="today-lesson"
              >
                <span className="rounded-xl bg-primary/8 px-3.5 py-3 text-sm font-bold text-primary">
                  {formatTime(lesson.startsAt)} - {formatTime(lesson.endsAt)}
                </span>
                <div className="min-w-[8rem] flex-1">
                  <p className="font-bold text-foreground-strong">{lesson.branchName}</p>
                  <p className="text-[0.82rem] text-muted">{lesson.expected} сурагч</p>
                </div>
                {lesson.status === "CANCELLED" ? (
                  <StatusChip tone="neutral">Цуцлагдсан</StatusChip>
                ) : done ? (
                  <StatusChip tone="success">Ирц бөглөсөн</StatusChip>
                ) : (
                  <Button asChild className="w-full rounded-full sm:w-auto">
                    <Link to={`/teacher/attendance/${lesson.id}`}>Ирц бүртгэх</Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Ирц бөглөөгүй хичээл (ФШ-70): maroon хүчтэй карт. Ирц хадгалмагц тэр дороо хасагдана.
function AttentionCard({ lessons }: { lessons: DashboardLessonDto[] }) {
  if (lessons.length === 0) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-6 text-primary-foreground shadow-lg">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
          <Sparkles className="size-4 text-accent" /> Бүх ирц бөглөгдсөн
        </p>
        <p className="mt-2 font-display text-2xl font-bold">Өнгөрсөн хичээл бүрийн ирц бүртгэгдсэн байна.</p>
      </section>
    );
  }
  return (
    <section
      className="rounded-3xl bg-gradient-to-br from-primary to-primary-hover p-5 text-primary-foreground shadow-lg sm:p-6"
      data-testid="unfilled-lessons"
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
        <Sparkles className="size-4 text-accent" /> Ирц бөглөөгүй хичээл ({lessons.length})
      </p>
      <ul className="mt-3 grid gap-2.5">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3.5"
            data-testid="unfilled-lesson"
          >
            <div>
              <p className="font-display text-lg font-bold">
                {formatDate(lesson.startsAt)} · {formatTime(lesson.startsAt)}
              </p>
              <p className="text-[0.82rem] text-white/80">
                {lesson.branchName} · {lesson.expected} сурагч
              </p>
            </div>
            <Link
              to={`/teacher/attendance/${lesson.id}`}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-primary transition-colors hover:bg-background"
            >
              Ирц бүртгэх
            </Link>
          </li>
        ))}
      </ul>
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
      <PanelTitle icon={Sparkles}>
        <span id="actions-title">Шуурхай үйлдлүүд</span>
      </PanelTitle>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border-warm bg-background-soft/60 p-3 text-center text-[0.82rem] font-semibold text-mid transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary"
          >
            <a.icon className="size-6 text-primary" />
            {a.label}
          </Link>
        ))}
      </div>
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
      <ul className="grid gap-2.5">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background-soft/60 p-3.5">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground-strong">{task.studentName}</p>
              <p className="text-[0.82rem] text-muted">
                {task.programName} · {formatDate(task.dueOn)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone={task.type === "MEETING" ? "warning" : "info"}>
                {task.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт"}
              </StatusChip>
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/teacher/students/${task.studentId}`}>Нээх</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Багшийн нүүр: мэндчилгээ, дөрвөн үзүүлэлт, өнөөдрийн хичээл, сурагчдын ахиц, анхаарах зүйл (ФШ-43, 70).
export function TeacherHome() {
  const dash = useTeacherDashboard();
  const d = dash.data;

  return (
    <>
      <header className="relative mb-7">
        <div aria-hidden="true" className="pointer-events-none absolute right-2 top-0 hidden h-28 w-56 md:block">
          <span className="absolute right-6 top-0 font-display text-[6.5rem] font-black leading-none text-primary/10">π</span>
          <Sparkles className="absolute left-4 top-3 size-9 text-accent" />
          <Sparkles className="absolute bottom-2 left-16 size-5 text-accent/70" />
        </div>
        <h1 className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-black leading-tight text-foreground-strong">
          {d?.teacherName ? `${d.teacherName} багшдаа` : "Сайн байна уу"} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1.5 text-base text-mid">Өнөөдрийн ажлын амжилт хүсье!</p>
      </header>

      <PushEnableCard />

      {dash.isError ? (
        <p role="alert" className="mb-4 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          Самбарыг ачаалж чадсангүй.
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" data-testid="teacher-stats">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="contents lg:grid lg:content-start lg:gap-6">
          <div className="order-2">
            <TodayLessons lessons={d?.todayLessons ?? []} />
          </div>
          <section className={cn(panel, "order-5")} aria-labelledby="trend-title">
            <PanelTitle icon={TrendingUp}>
              <span id="trend-title">Сурагчдын ахиц (%)</span>
            </PanelTitle>
            {d && d.progress.length > 0 ? (
              <ProgressTrend points={d.progress} />
            ) : (
              <p className="rounded-2xl bg-background-soft px-5 py-10 text-center text-sm text-muted">
                Сорил, шалгалт бүртгэгдэхэд сарын дундаж дүнгийн график энд гарна.
              </p>
            )}
          </section>
        </div>
        <div className="contents lg:grid lg:content-start lg:gap-6">
          <div className="order-1">
            <AttentionCard lessons={d?.unfilledLessons ?? []} />
          </div>
          <div className="order-3">
            <QuickActions />
          </div>
          <div className="order-4">
            <Reminders tasks={d?.tasks ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}
