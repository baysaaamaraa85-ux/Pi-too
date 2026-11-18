import type { DashboardLessonDto, TeacherCategoryDto, TeacherTaskDto } from "@pitoo/contracts";
import { ArrowRight, ArrowUpRight, CalendarCheck, Pencil, TriangleAlert } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { PushEnableCard } from "@/features/notifications/push-card";
import { DarkTrend } from "@/features/progress/dark-trend";
import { formatDate, formatTime, weekdayName, weekdayOf } from "@/shared/format/date";
import { Reveal } from "@/shared/pt/motion";
import "@/shared/pt/pt.css";
import { Button } from "@/shared/ui/button";
import { StatusChip, type ChipTone } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useTeacherDashboard } from "./dashboard-api";
import { TEACHER_ACTIONS } from "./teacher-actions";
import { TeacherArc } from "./teacher-arc";


// Багшийн нүүр (D-87, teacher_today_v5.html): мэндчилгээ, 3D карусель (үзүүлэлтүүд), өнөөдрийн хичээл (ирц бүртгэх), ахиц ба категори,
// сануулга, шуурхай үйлдэл. Өгөгдөл, функц өмнөхтэй ижил (ФШ-43, 70), харагдах байдал шинэ.

// Хичээлийн төлвийг (явагдаж байна / удахгүй) минут тутам шинэчилнэ.
function useNow(everyMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

// "2 цаг", "45 мин", "1 цаг 30 мин"
function durationLabel(startsAt: string, endsAt: string) {
  const mins = Math.max(0, Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} цаг` : `${h} цаг ${m} мин`;
}

// Хэсгийн гарчиг: жижиг улаан бичиг, том гарчиг, баруун талд үйлдэл
function SectionHead({ eyebrow, title, action, id }: { eyebrow: string; title: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[13px] font-medium text-brand-600">{eyebrow}</p>
        <h2 id={id} className="pt-tight mt-1 text-[30px] font-semibold leading-tight sm:text-[40px]">
          {title}
        </h2>
      </div>
      {action}
    </Reveal>
  );
}

// ---- Мэндчилгээ
function Hero({ name, activeToday, now }: { name: string | undefined; activeToday: number | null; now: number }) {
  const date = new Date(now);
  const words = [
    { text: "Сайн байна уу,", accent: false },
    { text: name ? `${name} багш.` : "багш аа.", accent: true },
  ];
  return (
    <section className="px-1 pt-6 text-center sm:pt-10">
      <p
        className="pt-word pt-glass pt-num h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium text-ink-600"
        style={{ animationDelay: "0.05s", display: "inline-flex" }}
      >
        <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_4px_rgba(29,122,70,0.15)]" aria-hidden="true" />
        {formatDate(date)} · {weekdayName(weekdayOf(date))}
      </p>
      <h1 className="pt-tight mx-auto mt-6 max-w-[900px] text-[38px] font-semibold leading-[1.02] sm:text-[58px] lg:text-[68px]">
        {words.map((w, i) => (
          <span key={w.text} className={cn("block", w.accent && "text-brand-700")}>
            <span className="pt-word" style={{ animationDelay: `${(0.15 + i * 0.09).toFixed(2)}s` }}>
              {w.text}
            </span>
          </span>
        ))}
      </h1>
      <p className="pt-word mx-auto mt-5 max-w-[520px] text-[15.5px] text-ink-500 sm:text-[17px]" style={{ animationDelay: "0.55s", display: "block" }}>
        Өнөөдрийн ажилд амжилт хүсье!
        {activeToday === null ? null : activeToday > 0 ? (
          <>
            {" "}
            Танд өнөөдөр <strong className="font-semibold text-ink-900">{activeToday} хичээл</strong> байна.
          </>
        ) : (
          " Өнөөдөр хичээл алга."
        )}
      </p>
      <div className="pt-word mt-7 flex flex-wrap items-center justify-center gap-2.5" style={{ animationDelay: "0.7s", display: "flex" }}>
        <Link
          to="/teacher/calendar"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 px-6 text-[14px] font-medium text-white shadow-[0_12px_30px_-10px_rgba(139,26,26,0.55)] transition hover:bg-brand-800"
        >
          Хуваарь харах <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link to="/teacher/classes" className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[14px] font-medium text-ink-700 transition hover:bg-paper-2">
          Анги нэмэх
        </Link>
      </div>
    </section>
  );
}

type LessonState = "unfilled" | "partial" | "done" | "cancelled" | "live" | "upcoming";

const STATE_CHIP: Record<LessonState, { tone: ChipTone; text: string }> = {
  unfilled: { tone: "danger", text: "Ирц бөглөөгүй" },
  partial: { tone: "warning", text: "Ирц дутуу" },
  done: { tone: "success", text: "Ирц бөглөсөн" },
  cancelled: { tone: "neutral", text: "Цуцлагдсан" },
  live: { tone: "info", text: "Явагдаж байна" },
  upcoming: { tone: "neutral", text: "Удахгүй" },
};

function lessonState(lesson: DashboardLessonDto, unfilled: boolean, now: number): LessonState {
  if (unfilled) return "unfilled";
  if (lesson.status === "CANCELLED") return "cancelled";
  if (lesson.expected > 0 && lesson.recorded >= lesson.expected) return "done";
  if (Date.parse(lesson.startsAt) > now) return "upcoming";
  // Дууссан боловч бүх сурагчийн ирц бүртгэгдээгүй хичээл "дутуу", үргэлжилж байгаа нь "явагдаж байна".
  return Date.parse(lesson.endsAt) <= now ? "partial" : "live";
}

// Хичээлийн нэг мөр: харанхуй цагийн хайрцаг, салбар, хугацаа ба сурагчийн тоо, төлөв, үйлдэл. Ирц бөглөөгүй мөр улаавтар.
function LessonRow({ lesson, unfilled, now }: { lesson: DashboardLessonDto; unfilled: boolean; now: number }) {
  const state = lessonState(lesson, unfilled, now);
  const chip = STATE_CHIP[state];
  const sameDay = formatDate(lesson.startsAt) === formatDate(new Date(now));
  const attendanceTo = `/teacher/attendance/${lesson.id}`;
  const when = sameDay ? durationLabel(lesson.startsAt, lesson.endsAt) : formatDate(lesson.startsAt).slice(5);
  const partial = state !== "done" && state !== "cancelled" && lesson.recorded > 0 ? ` · ${lesson.recorded} бүртгэгдсэн` : "";
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[22px] border p-3.5",
        state === "unfilled" ? "border-danger/25 bg-gradient-to-b from-danger-bg to-white" : "border-ink-900/[.07] bg-white",
      )}
      data-testid={unfilled ? "unfilled-lesson" : "today-lesson"}
    >
      <div
        className={cn(
          "pt-num shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold text-white",
          state === "unfilled" ? "bg-danger" : state === "cancelled" ? "bg-ink-400" : "bg-[#141110]",
        )}
      >
        {formatTime(lesson.startsAt)} - {formatTime(lesson.endsAt)}
      </div>
      <div className="min-w-[7rem] flex-1">
        <p className="text-[15px] font-semibold sm:truncate">{lesson.branchName}</p>
        <p className="text-[12.5px] text-ink-500">
          {when} · {lesson.expected} сурагч{partial}
        </p>
      </div>
      <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
        <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
        {state === "done" ? (
          <Link
            to={attendanceTo}
            aria-label="Ирц засах"
            className="grid size-11 place-items-center rounded-full border border-ink-900/10 bg-white text-ink-600 transition-colors hover:border-brand-700 hover:text-brand-700 motion-reduce:transition-none"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Link>
        ) : state === "cancelled" ? null : (
          <Button asChild variant={state === "unfilled" || state === "live" ? "primary" : "secondary"} className="rounded-full px-5">
            <Link to={attendanceTo}>Ирц бүртгэх</Link>
          </Button>
        )}
      </div>
    </li>
  );
}

// Өнөөдрийн хичээл ба ирц бөглөөгүй хичээл (ФШ-70) нэг жагсаалтад: бөглөөгүй нь дээд талд, улаавтар.
// Ирц хадгалмагц бөглөөгүй мөр тэр дороо арилна.
function TodayLessons({ lessons, unfilled, now }: { lessons: DashboardLessonDto[]; unfilled: DashboardLessonDto[]; now: number }) {
  const unfilledIds = new Set(unfilled.map((l) => l.id));
  const today = lessons.filter((l) => !unfilledIds.has(l.id));
  const empty = today.length === 0 && unfilled.length === 0;
  return (
    <section className="mt-16 sm:mt-24" aria-labelledby="today-title" data-testid="today-lessons">
      <SectionHead
        eyebrow="Ирц бүртгэх"
        id="today-title"
        title="Өнөөдрийн хичээл"
        action={
          <Link to="/teacher/calendar" className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-brand-700 hover:text-brand-800">
            Бүгдийг харах <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      />
      <div className="mt-6">
        {empty ? (
          <div className="grid justify-items-center gap-1.5 rounded-[22px] border border-ink-900/[.07] bg-white px-5 py-8 text-center">
            <CalendarCheck className="size-7 text-brand-400" aria-hidden="true" />
            <p className="text-[14px] text-ink-500">Өнөөдөр хичээл алга.</p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {unfilled.length > 0 ? (
              <ul className="grid gap-2.5" data-testid="unfilled-lessons" aria-label="Ирц бөглөөгүй хичээл">
                {unfilled.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} unfilled now={now} />
                ))}
              </ul>
            ) : null}
            {today.length > 0 ? (
              <ul className="grid gap-2.5">
                {today.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} unfilled={false} now={now} />
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

// ---- Категори: багш сурагчдаа өөрийн нэрлэсэн категориор хуваасан байдал (дугуй цагираг ба шошго).
const CAT_COLORS = ["#B54848", "#F2AE3A", "#F3F1EE", "#4CC27E", "#CE9F9F"];

function Categories({ categories }: { categories: TeacherCategoryDto[] }) {
  const total = categories.reduce((s, c) => s + c.students, 0);
  // Сонгосон категориос бусдыг цагирагт бүдэгрүүлнэ (зөвхөн харагдац, шүүлт биш).
  const [picked, setPicked] = React.useState<string | null>(null);
  const keyOf = (c: TeacherCategoryDto) => c.categoryId ?? "none";
  const chip = "inline-flex h-11 items-center gap-2 rounded-full border pl-3.5 pr-1.5 text-[13px] font-medium transition";
  return (
    <Reveal as="article" delay={60} className="pt-lib flex flex-col lg:col-span-4" style={{ "--tint": "#F7F1E6" } as React.CSSProperties}>
      <section className="flex h-full flex-col" aria-labelledby="cat-title" data-testid="categories">
        <div className="pt-cover pt-dark grid h-[190px] place-items-center">
          <div className="pt-glow" style={{ background: "radial-gradient(45% 55% at 50% 55%,rgba(242,174,58,.35),transparent 70%)" }} />
          <div className="pt-noise" />
          <svg viewBox="0 0 200 200" className="relative size-[160px] -rotate-90" aria-hidden="true">
            {total > 0
              ? categories.slice(0, CAT_COLORS.length).map((c, i) => {
                  const r = 88 - i * 16;
                  const len = 2 * Math.PI * r;
                  const color = CAT_COLORS[i % CAT_COLORS.length]!;
                  const dim = picked !== null && picked !== keyOf(c);
                  return (
                    <g key={keyOf(c)}>
                      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
                      <circle
                        cx="100"
                        cy="100"
                        r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={len}
                        strokeDashoffset={len * (1 - c.students / total)}
                        style={{ opacity: dim ? 0.2 : 1, transition: "opacity .3s", filter: `drop-shadow(0 0 6px ${color}88)` }}
                      />
                    </g>
                  );
                })
              : null}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-white" aria-hidden="true">
            <div>
              <div className="pt-tight pt-num text-[34px] font-semibold leading-none">{total}</div>
              <div className="mt-1 text-[11px] text-white/60">сурагч</div>
            </div>
          </div>
        </div>
        <div className="pt-meta flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 id="cat-title" className="text-[14px] font-semibold">
              Категори
            </h2>
            <Link
              to="/teacher/students"
              className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold text-brand-700 hover:bg-white"
            >
              Категори нэмэх, засах
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Категори">
            <button
              type="button"
              aria-pressed={picked === null}
              onClick={() => setPicked(null)}
              className={cn(chip, picked === null ? "border-brand-700 bg-brand-700 text-white" : "border-paper-3 bg-white/80 text-ink-700 hover:border-ink-300")}
            >
              Бүгд
              <span
                className={cn("pt-num grid h-8 min-w-[26px] place-items-center rounded-full px-2 text-[11.5px]", picked === null ? "bg-white/15" : "bg-paper-2 text-ink-500")}
                data-testid="category-total"
              >
                {total}
              </span>
            </button>
            {categories.map((c, i) => {
              const on = picked === keyOf(c);
              return (
                <button
                  key={keyOf(c)}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked(on ? null : keyOf(c))}
                  className={cn(chip, on ? "border-brand-700 bg-brand-700 text-white" : "border-paper-3 bg-white/80 text-ink-700 hover:border-ink-300")}
                  data-testid="category-row"
                >
                  {i < CAT_COLORS.length ? (
                    <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: CAT_COLORS[i] }} aria-hidden="true" />
                  ) : null}
                  {c.name}
                  <span className={cn("pt-num grid h-8 min-w-[26px] place-items-center rounded-full px-2 text-[11.5px]", on ? "bg-white/15" : "bg-paper-2 text-ink-500")}>
                    {c.students}
                  </span>
                </button>
              );
            })}
          </div>
          {categories.length === 0 ? <p className="mt-3 text-[13px] text-ink-500">Идэвхтэй сурагч алга.</p> : null}
        </div>
      </section>
    </Reveal>
  );
}

// ---- Сануулга: эцэг эхтэй уулзах, багцын шалгалт
function Reminders({ tasks }: { tasks: TeacherTaskDto[] }) {
  if (tasks.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24" aria-labelledby="tasks-title" data-testid="teacher-tasks">
      <SectionHead eyebrow="Анхаарах" id="tasks-title" title={`Сануулга (${tasks.length})`} />
      <ul className="mt-6 grid gap-2.5 md:grid-cols-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-[22px] border border-ink-900/[.07] bg-white p-3.5">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{task.studentName}</p>
              <p className="text-[12.5px] text-ink-500">
                {task.programName} · {formatDate(task.dueOn)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip tone={task.type === "MEETING" ? "warning" : "info"}>{task.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт"}</StatusChip>
              <Button variant="secondary" size="sm" className="rounded-full" asChild>
                <Link to={`/teacher/students/${task.studentId}`}>Нээх</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- Шуурхай үйлдлүүд: харанхуй гэрэлтдэг cover-той карт, дарахад холбогдох хуудас руу
function QuickActions() {
  return (
    <section className="mt-16 sm:mt-24" aria-labelledby="actions-title">
      <SectionHead eyebrow="Шуурхай үйлдлүүд" id="actions-title" title="Нэг товшилтоор эхэл." />
      <ul className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {TEACHER_ACTIONS.map((a, i) => (
          <Reveal key={a.to} as="li" delay={i * 70} className="pt-lib group flex" style={{ "--tint": a.tint } as React.CSSProperties}>
            <Link to={a.to} className="flex w-full flex-col">
              <div className="pt-cover pt-dark grid h-[150px] place-items-center sm:h-[180px]">
                <div className="pt-glow" style={{ background: `radial-gradient(40% 45% at 50% 55%,rgba(${a.hue},.55),transparent 70%)` }} />
                <div className="pt-dots" />
                <div className="pt-noise" />
                <span
                  className="relative grid size-16 place-items-center rounded-[22px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 sm:size-[72px]"
                  style={{
                    background: "linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04))",
                    border: "1px solid rgba(255,255,255,.22)",
                    boxShadow: `0 0 40px rgba(${a.hue},.55),inset 0 1px 0 rgba(255,255,255,.3)`,
                  }}
                  aria-hidden="true"
                >
                  <a.icon className="size-7" />
                </span>
                <span
                  className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-white/10 bg-white/10 text-white/70 transition group-hover:bg-white group-hover:text-ink-900"
                  aria-hidden="true"
                >
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <div className="pt-meta flex-1 px-4 py-3.5">
                <div className="text-[14.5px] font-semibold">{a.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-500">
                  <span className="grid size-4 place-items-center rounded-full bg-brand-700 text-[8px] text-white" aria-hidden="true">
                    π
                  </span>
                  Пи тоо<span className="text-ink-300">·</span>
                  {a.tag}
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

export function TeacherHome() {
  const dash = useTeacherDashboard();
  const d = dash.data;
  const now = useNow();
  const activeToday = d ? d.todayLessons.filter((l) => l.status !== "CANCELLED").length : null;

  return (
    <>
      <Hero name={d?.teacherName} activeToday={activeToday} now={now} />

      <div className="mx-auto mt-6 max-w-[1240px] empty:hidden">
        <PushEnableCard />
        {d && d.unratedStudents.length > 0 ? (
          <div
            role="status"
            data-testid="unrated-notice"
            className="pt-glass mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] px-4 py-3 text-sm font-medium text-warning"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              {d.unratedStudents.length} сурагчид цагийн үнэлгээ оруулаагүй байна. Оруулаагүй хүүхдийн цалин 0 ₮ бодогдоно.
            </span>
            <Link to={`/teacher/students/${d.unratedStudents[0]!.studentId}`} className="inline-flex min-h-11 items-center font-semibold underline">
              Үнэлгээ оруулах
            </Link>
          </div>
        ) : null}
        {dash.isError ? (
          <p role="alert" className="mb-4 rounded-[22px] bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
            Самбарыг ачаалж чадсангүй.
          </p>
        ) : null}
      </div>

      <div className="mt-4" data-testid="teacher-stats">
        <TeacherArc d={d} now={now} />
      </div>

      <div className="mx-auto max-w-[1240px]">
        <TodayLessons lessons={d?.todayLessons ?? []} unfilled={d?.unfilledLessons ?? []} now={now} />

        <section className="mt-16 sm:mt-24">
          <SectionHead eyebrow="Ахиц ба ангилал" title="Сурагчид хэр ахиж байна?" />
          <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
            <DarkTrend points={d?.progress ?? []} className="lg:col-span-8" />
            <Categories categories={d?.categories ?? []} />
          </div>
        </section>

        <Reminders tasks={d?.tasks ?? []} />
        <QuickActions />
      </div>
    </>
  );
}
