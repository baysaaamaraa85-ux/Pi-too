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
import { Banner, PanelTitle, StatCard, panelClass } from "@/shared/ui/dash";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useTeacherDashboard } from "./dashboard-api";

const panel = panelClass;

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
  // Өргөнийг хэмжиж viewBox-д өгнө: график ямар өргөнтэй ч бичвэр 1:1 хэмжээтэй, өндөр тогтмол.
  const box = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(320);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, Math.round(el.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = 160;
  const pad = { left: 38, right: 24, top: 22, bottom: 26 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const inset = 34;
  const x = (i: number) =>
    pad.left + (buckets.length <= 1 ? innerW / 2 : inset + (i / (buckets.length - 1)) * (innerW - 2 * inset));
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const filled = buckets.flatMap((b, i) => (b.value === null ? [] : [{ i, label: b.label, value: b.value }]));
  const line = filled.map((p) => `${x(p.i)},${y(p.value)}`).join(" ");
  const area = filled.length > 1 ? `${x(filled[0]!.i)},${pad.top + innerH} ${line} ${x(filled[filled.length - 1]!.i)},${pad.top + innerH}` : "";

  return (
    <div ref={box} className="w-full min-w-0 overflow-hidden">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Сурагчдын дундаж ахиц: ${filled.map((p) => `${p.label} ${Math.round(p.value)}%`).join(", ")}`}
      className="block"
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
          <text x={x(p.i)} y={y(p.value) - 12} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-primary)">
            {Math.round(p.value)}%
          </text>
        </g>
      ))}
      {buckets.map((b, i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="12.5" fill="var(--color-mid)">
          {b.label}
        </text>
      ))}
    </svg>
    </div>
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
          <div role="group" aria-label="Хугацаа" className="flex gap-0.5 rounded-xl bg-background-soft p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "min-h-11 rounded-lg px-3.5 text-[0.8rem] font-semibold transition-colors",
                  range === r.key ? "bg-primary text-primary-foreground shadow-soft" : "text-mid hover:text-primary",
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
        <p className="rounded-2xl bg-background-soft px-5 py-10 text-center text-sm text-muted">
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
    <section className={panel} aria-labelledby="cat-title" data-testid="categories">
      <PanelTitle icon={LayoutGrid}>
        <span id="cat-title">Категори</span>
      </PanelTitle>
      <ul className="grid max-h-44 gap-1 overflow-y-auto pr-0.5">
        <li className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 text-sm font-semibold text-primary">
          <span>Бүгд</span>
          <span data-testid="category-total">{total}</span>
        </li>
        {categories.map((c) => (
          <li
            key={c.programId}
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
          <Link to="/teacher/calendar" className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Бүгдийг харах <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <span id="today-title">Өнөөдрийн хичээл</span>
      </PanelTitle>
      {empty ? (
        <p className="rounded-xl bg-background-soft px-5 py-6 text-center text-sm text-muted">Өнөөдөр хичээл алга.</p>
      ) : (
        <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">
          {unfilled.length > 0 ? (
            <ul className="grid gap-2" data-testid="unfilled-lessons" aria-label="Ирц бөглөөгүй хичээл">
              {unfilled.map((lesson) => (
                <li
                  key={lesson.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/6 p-2.5"
                  data-testid="unfilled-lesson"
                >
                  <span className="rounded-lg bg-primary/10 px-3 py-2.5 text-[0.82rem] font-bold text-primary">
                    {formatDate(lesson.startsAt)} {formatTime(lesson.startsAt)}
                  </span>
                  <div className="min-w-[8rem] flex-1">
                    <p className="text-sm font-semibold text-foreground-strong">{lesson.branchName}</p>
                    <p className="text-xs text-danger">Ирц бөглөөгүй · {lesson.expected} сурагч</p>
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
                    <span className="rounded-lg bg-primary/8 px-3 py-2.5 text-[0.82rem] font-bold text-primary">
                      {formatTime(lesson.startsAt)} - {formatTime(lesson.endsAt)}
                    </span>
                    <div className="min-w-[8rem] flex-1">
                      <p className="text-sm font-semibold text-foreground-strong">{lesson.branchName}</p>
                      <p className="text-xs text-muted">{lesson.expected} сурагч</p>
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
      <PanelTitle icon={Sparkles}>
        <span id="actions-title">Шуурхай үйлдлүүд</span>
      </PanelTitle>
      <ul className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <li key={a.to}>
            <Link
              to={a.to}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-border-warm bg-background-soft/60 px-2.5 text-[0.8rem] font-medium leading-tight text-mid transition-colors hover:border-primary/30 hover:text-primary"
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
      <ul className="grid max-h-36 gap-2 overflow-y-auto pr-1">
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
      <Banner
        title={
          <>
            {d?.teacherName ? `${d.teacherName} багшдаа` : "Сайн байна уу"} <span aria-hidden="true">👋</span>
          </>
        }
        subtitle="Өнөөдрийн ажлын амжилт хүсье!"
      />
      <PushEnableCard />

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
