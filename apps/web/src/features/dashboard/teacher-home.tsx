import type {
  DashboardLessonDto,
  TeacherCategoryDto,
  TeacherProgressPointDto,
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
import { addDaysToKey, formatDate, formatTime, localDateKey, weekdayName, weekdayOf } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useTeacherDashboard } from "./dashboard-api";
import { CapAndBooks, HeroWaves } from "./hero-art";

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

// ---- Баннер: долгионтой дэвсгэр, мэндчилгээ, төгсөлтийн малгай ба ном
function Banner({ name }: { name: string | undefined }) {
  return (
    <header className="relative mb-6 min-h-44 overflow-hidden rounded-3xl border border-border-warm bg-gradient-to-br from-[#fff7f1] via-[#fbeee5] to-[#f6dccd] shadow-md sm:min-h-52">
      <HeroWaves />
      <div className="relative z-10 max-w-[56%] px-5 py-7 sm:max-w-[58%] sm:px-9 sm:py-10">
        <h1 className="font-display text-[clamp(1.7rem,3.6vw,3rem)] font-black leading-tight text-foreground-strong">
          {name ? `${name} багшдаа` : "Сайн байна уу"} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 text-sm text-mid sm:text-base">Өнөөдрийн ажлын амжилт хүсье!</p>
      </div>
      <CapAndBooks className="pointer-events-none absolute -bottom-2 -right-3 z-10 h-28 w-auto sm:right-8 sm:-bottom-3 sm:h-52 md:h-56" />
    </header>
  );
}

// ---- Сурагчдын ахиц: 7 хоног, 1 сар, 3 сараар нэгтгэсэн дундаж дүн (%)
type Range = "week" | "month" | "quarter";
const RANGES: { key: Range; label: string }[] = [
  { key: "week", label: "7 хоног" },
  { key: "month", label: "1 сар" },
  { key: "quarter", label: "3 сар" },
];

interface Bucket {
  label: string;
  value: number | null;
}

function daysBetween(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

// Өдөр тутмын дундажуудыг (жин нь сорилын тоо) сонгосон хугацаагаар нэгтгэнэ.
export function bucketize(points: TeacherProgressPointDto[], range: Range, today: string): Bucket[] {
  const weighted = (items: TeacherProgressPointDto[]): number | null => {
    const count = items.reduce((s, p) => s + p.count, 0);
    if (count === 0) return null;
    return items.reduce((s, p) => s + Number(p.averagePercent) * p.count, 0) / count;
  };

  if (range === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDaysToKey(today, i - 6);
      return {
        label: weekdayName(weekdayOf(key)).slice(0, 3),
        value: weighted(points.filter((p) => p.date === key)),
      };
    });
  }
  if (range === "month") {
    return Array.from({ length: 5 }, (_, i) => {
      const b = 4 - i; // 4 = хамгийн эртний 7 хоног
      const start = addDaysToKey(today, -(b * 7 + 6));
      const inBucket = points.filter((p) => Math.floor(daysBetween(p.date, today) / 7) === b);
      return { label: `${start.slice(5, 7)}.${start.slice(8, 10)}`, value: weighted(inBucket) };
    });
  }
  const monthOf = (key: string, delta: number) => {
    const [y, m] = key.split("-").map(Number) as [number, number];
    const idx = y * 12 + (m - 1) + delta;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  };
  return [-2, -1, 0].map((delta) => {
    const month = monthOf(today, delta);
    return {
      label: `${Number(month.slice(5, 7))}-р сар`,
      value: weighted(points.filter((p) => p.date.startsWith(month))),
    };
  });
}

export function ProgressTrend({ buckets }: { buckets: Bucket[] }) {
  const id = React.useId().replace(/:/g, "");
  const width = 480;
  const height = 250;
  const pad = { left: 38, right: 22, top: 30, bottom: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const inset = 26;
  const x = (i: number) =>
    pad.left + (buckets.length <= 1 ? innerW / 2 : inset + (i / (buckets.length - 1)) * (innerW - 2 * inset));
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const filled = buckets.flatMap((b, i) => (b.value === null ? [] : [{ i, label: b.label, value: b.value }]));
  const line = filled.map((p) => `${x(p.i)},${y(p.value)}`).join(" ");
  const area = filled.length > 1 ? `${x(filled[0]!.i)},${pad.top + innerH} ${line} ${x(filled[filled.length - 1]!.i)},${pad.top + innerH}` : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Сурагчдын дундаж ахиц: ${filled.map((p) => `${p.label} ${Math.round(p.value)}%`).join(", ")}`}
      className="h-auto w-full"
      data-testid="trend-chart"
    >
      <defs>
        <linearGradient id={`area-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeDasharray="3 5" />
          <text x={pad.left - 10} y={y(g) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">
            {g}
          </text>
        </g>
      ))}
      {area ? <polygon points={area} fill={`url(#area-${id})`} /> : null}
      {filled.length > 1 ? (
        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={line} />
      ) : null}
      {filled.map((p) => (
        <g key={p.i} data-testid="trend-point">
          <circle cx={x(p.i)} cy={y(p.value)} r="5.5" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2.5" />
          <text x={x(p.i)} y={y(p.value) - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-primary)">
            {Math.round(p.value)}%
          </text>
        </g>
      ))}
      {buckets.map((b, i) => (
        <text key={i} x={x(i)} y={height - 10} textAnchor="middle" fontSize="12.5" fill="var(--color-mid)">
          {b.label}
        </text>
      ))}
    </svg>
  );
}

function ProgressPanel({ points }: { points: TeacherProgressPointDto[] }) {
  const [range, setRange] = React.useState<Range>("month");
  const today = localDateKey(new Date());
  const buckets = React.useMemo(() => bucketize(points, range, today), [points, range, today]);
  const hasData = buckets.some((b) => b.value !== null);

  return (
    <section className={panel} aria-labelledby="trend-title">
      <PanelTitle
        icon={TrendingUp}
        action={
          <div role="group" aria-label="Хугацаа" className="flex gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors",
                  range === r.key
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "border border-border-warm bg-background-soft text-mid hover:border-primary/30",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      >
        <span id="trend-title">Сурагчдын ахиц (%)</span>
      </PanelTitle>
      {hasData ? (
        <ProgressTrend buckets={buckets} />
      ) : (
        <p className="rounded-2xl bg-background-soft px-5 py-12 text-center text-sm text-muted">
          Энэ хугацаанд сорил, шалгалтын дүн бүртгэгдээгүй байна.
        </p>
      )}
    </section>
  );
}

// ---- Категори: багш сурагчдаа хөтөлбөрөөр хуваасан байдал
function Categories({ categories }: { categories: TeacherCategoryDto[] }) {
  const total = categories.reduce((s, c) => s + c.students, 0);
  return (
    <section className="overflow-hidden rounded-3xl border border-border-warm bg-surface shadow-md" aria-labelledby="cat-title" data-testid="categories">
      <h2 id="cat-title" className="bg-gradient-to-br from-primary to-primary-hover px-5 py-4 font-display text-xl font-bold text-primary-foreground">
        Категори
      </h2>
      <ul className="grid gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
        <li className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-primary/8 px-3.5 font-semibold text-primary">
          <span className="flex items-center gap-2.5">
            <LayoutGrid className="size-[18px]" /> Бүгд
          </span>
          <span data-testid="category-total">{total}</span>
        </li>
        {categories.map((c) => (
          <li key={c.programId} className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 text-sm font-medium text-mid" data-testid="category-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <BookOpen className="size-[18px] shrink-0 text-muted" />
              <span className="truncate">{c.name}</span>
            </span>
            <span className="font-semibold text-muted">{c.students}</span>
          </li>
        ))}
        {categories.length === 0 ? (
          <li className="px-3.5 py-3 text-sm text-muted">Идэвхтэй сурагч алга.</li>
        ) : null}
      </ul>
    </section>
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

// Багшийн нүүр: баннер, дөрвөн үзүүлэлт, категори, өнөөдрийн хичээл, ахицын график, анхаарах зүйл (ФШ-43, 70).
export function TeacherHome() {
  const dash = useTeacherDashboard();
  const d = dash.data;

  return (
    <>
      <Banner name={d?.teacherName} />
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

      {/* Утсанд нэг багана (order), lg-д хоёр, xl-д гурван багана: категори | хичээл, график | анхаарах зүйл */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_19rem]">
        <div className="order-3 lg:order-3 lg:col-span-2 xl:order-1 xl:col-span-1">
          <Categories categories={d?.categories ?? []} />
        </div>
        <div className="contents lg:order-1 lg:grid lg:content-start lg:gap-6 xl:order-2">
          <div className="order-2">
            <TodayLessons lessons={d?.todayLessons ?? []} />
          </div>
          <div className="order-6">
            <ProgressPanel points={d?.progress ?? []} />
          </div>
        </div>
        <div className="contents lg:order-2 lg:grid lg:content-start lg:gap-6 xl:order-3">
          <div className="order-1">
            <AttentionCard lessons={d?.unfilledLessons ?? []} />
          </div>
          <div className="order-4">
            <QuickActions />
          </div>
          <div className="order-5">
            <Reminders tasks={d?.tasks ?? []} />
          </div>
        </div>
      </div>
    </>
  );
}
