import type { TeacherDashboardDto } from "@pitoo/contracts";
import { CalendarCheck, CheckCheck, Sparkles, TriangleAlert } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { formatDate, formatTime, weekdayName, weekdayOf } from "@/shared/format/date";
import { ArcStage, type ArcCard } from "@/shared/pt/arc-stage";

// Багшийн нүүрний 3D карусель (D-87, teacher_today_v5.html): дөрвөн үзүүлэлт ба өнөөдрийн хичээл. Өгөгдөл нь багшийн самбараас.
// Идэвхтэй картыг дарахад холбогдох хуудас руу шилжинэ (сурагч, хичээл, ирц бөглөөгүй хичээлийн ирц).
// Тест: stat-students, stat-lessons, stat-attendance, stat-unfilled (картын бүхэл агуулга).

const MAX_ORBS = 5;
const MONTH_CELLS = 30;
const ORB_COLORS = ["#B54848", "#F2AE3A", "#E9E6E1"];
const ORB_GLOWS = ["rgba(181,72,72,.6)", "rgba(242,174,58,.5)", "rgba(255,255,255,.25)"];

// Картын доод хэсэг: нэр, том тоо, баруун талд тайлбар
function Foot({ label, value, sub, tint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tint: string }) {
  return (
    <div className="flex h-[38%] flex-col justify-between px-5 py-4" style={{ background: `linear-gradient(180deg,${tint},#fff)` }}>
      <span className="text-[12.5px] font-medium text-ink-500">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="pt-tight pt-num text-[38px] font-semibold leading-none">{value}</span>
        <span className="pb-1 text-[12px] font-semibold">{sub}</span>
      </div>
    </div>
  );
}

const Dash = () => <span className="text-ink-300">–</span>;
const Percent = () => <span className="text-[22px] text-ink-300">%</span>;

export function TeacherArc({ d, now }: { d: TeacherDashboardDto | undefined; now: number }) {
  const today = new Date(now);
  const activeLessons = d ? d.todayLessons.filter((l) => l.status !== "CANCELLED") : [];
  const next = activeLessons.filter((l) => Date.parse(l.startsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const attendance = d && d.stats.attendancePercent !== null ? Number(d.stats.attendancePercent) : null;
  const unfilled = d?.unfilledLessons.length ?? null;
  const firstUnfilled = d?.unfilledLessons[0];
  const students = d?.stats.students ?? null;
  const lessons = d?.stats.lessonsThisMonth ?? null;
  const monthName = `${Number(formatDate(today).slice(5, 7))}-р сар`;

  const cards: ArcCard[] = [
    {
      key: "students",
      to: "/teacher/students",
      label: "Нийт сурагчид",
      node: () => (
        <div className="h-full" data-testid="stat-students">
          <div className="pt-dark relative h-[62%] overflow-hidden bg-[#141110]">
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 70% at 50% 60%,rgba(139,26,26,.5),transparent 70%)" }} />
            <div className="pt-dots" />
            <div className="pt-noise" />
            <div className="absolute inset-0 flex items-center justify-center gap-3" aria-hidden="true">
              {Array.from({ length: Math.min(students ?? 0, MAX_ORBS) }, (_, i) => (
                <span
                  key={i}
                  className="pt-breathe size-12 rounded-full"
                  style={{
                    background: `radial-gradient(circle at 35% 30%,#fff,${ORB_COLORS[i % 3]} 40%,#4A0A0A)`,
                    boxShadow: `0 0 30px ${ORB_GLOWS[i % 3]}`,
                    animationDuration: `${5 + i}s`,
                  }}
                />
              ))}
            </div>
          </div>
          <Foot
            label="Нийт сурагчид"
            value={students ?? <Dash />}
            tint="#F6E9E9"
            sub={
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                идэвхтэй
              </span>
            }
          />
        </div>
      ),
    },
    {
      key: "lessons",
      to: "/teacher/calendar",
      label: "Энэ сарын хичээл",
      node: () => (
        <div className="h-full" data-testid="stat-lessons">
          <div className="pt-dark relative h-[62%] overflow-hidden bg-[#141110]">
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 70% at 50% 40%,rgba(242,174,58,.32),transparent 70%)" }} />
            <div className="pt-noise" />
            <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <div className="grid grid-cols-6 gap-[7px]">
                {Array.from({ length: MONTH_CELLS }, (_, i) => {
                  const on = i < (lessons ?? 0);
                  return (
                    <span
                      key={i}
                      className={on ? "size-[14px] rounded-[4px]" : "size-[14px] rounded-[4px] opacity-20"}
                      style={{ background: on ? "#F7C978" : "#fff", boxShadow: on ? "0 0 10px rgba(242,174,58,.6)" : undefined }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <Foot
            label="Энэ сарын хичээл"
            value={lessons ?? <Dash />}
            tint="#F8F0E2"
            sub={<span className="text-ink-500">{monthName}</span>}
          />
        </div>
      ),
    },
    {
      key: "today",
      to: "/teacher/calendar",
      label: "Өнөөдрийн хичээл",
      node: () => (
        <div className="pt-dark relative h-full overflow-hidden bg-[#141110] text-white">
          <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 50% 38%,rgba(139,26,26,.55),transparent 70%)" }} />
          <div className="pt-dots" />
          <div className="pt-noise" />
          <div className="absolute left-1/2 top-[38%] size-[190px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="pt-orb-ring" style={{ inset: 0 }} />
          </div>
          <div className="pt-orb-core absolute left-1/2 top-[38%] size-[118px] -translate-x-1/2 -translate-y-1/2" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center" aria-hidden="true">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white" style={{ textShadow: "0 1px 8px rgba(61,11,11,.8)" }}>
              {weekdayName(weekdayOf(today))}
            </div>
            <div className="pt-tight pt-num text-[40px] font-semibold leading-none drop-shadow">{Number(formatDate(today).slice(8, 10))}</div>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="inline-flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 text-[11px] font-medium text-white/80">
              <CalendarCheck className="size-3" aria-hidden="true" />
              Өнөөдрийн хичээл
            </div>
            <div className="pt-tight mt-2 text-[22px] font-semibold leading-tight">
              {activeLessons.length > 0 ? `Өнөөдөр ${activeLessons.length} хичээл` : "Өнөөдөр хичээл алга"}
            </div>
            <div className="mt-1 text-[12.5px] text-white/65">
              {activeLessons.length === 0
                ? "Хуваарьт бүртгэгдсэн хичээл байхгүй."
                : next
                  ? `Дараагийнх ${formatTime(next.startsAt)} · ${next.branchName}`
                  : "Өнөөдрийн хичээл дууссан."}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "attendance",
      to: "/teacher/students",
      label: "Энэ сарын ирц",
      node: () => (
        <div className="h-full" data-testid="stat-attendance">
          <div className="pt-dark relative h-[62%] overflow-hidden bg-[#141110]">
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 70% at 50% 55%,rgba(181,72,72,.45),transparent 70%)" }} />
            <div className="pt-noise" />
            <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <svg viewBox="0 0 120 120" className="size-[130px] -rotate-90" style={{ filter: "drop-shadow(0 0 12px rgba(242,174,58,.55))" }}>
                <defs>
                  <linearGradient id="teacher-att-g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#F7C978" />
                    <stop offset="1" stopColor="#B54848" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="url(#teacher-att-g)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="301.6"
                  strokeDashoffset={301.6 * (1 - (attendance ?? 0) / 100)}
                />
              </svg>
            </div>
          </div>
          <Foot
            label="Энэ сарын ирц"
            value={attendance === null ? <Dash /> : <>{attendance}<Percent /></>}
            tint="#F7ECEC"
            sub={<span className="text-ink-500">Хичээлд хамрагдалт</span>}
          />
        </div>
      ),
    },
    {
      key: "unfilled",
      to: firstUnfilled ? `/teacher/attendance/${firstUnfilled.id}` : "/teacher/calendar",
      label: "Ирц бөглөөгүй хичээл",
      node: (active) => {
        const alert = unfilled !== null && unfilled > 0;
        return (
          <div className="h-full" data-testid="stat-unfilled">
            <div className={alert ? "pt-dark relative h-[62%] overflow-hidden bg-[#1A0F0F]" : "pt-dark relative h-[62%] overflow-hidden bg-[#0F1A14]"}>
              <div
                className="absolute inset-0"
                style={{
                  background: alert
                    ? "radial-gradient(60% 70% at 50% 55%,rgba(210,90,90,.45),transparent 70%)"
                    : "radial-gradient(60% 70% at 50% 55%,rgba(76,194,126,.38),transparent 70%)",
                }}
              />
              <div className="pt-dots" />
              <div className="pt-noise" />
              <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
                <span
                  className="grid size-20 place-items-center rounded-[24px] text-white"
                  style={{
                    background: "linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,255,255,.04))",
                    border: "1px solid rgba(255,255,255,.2)",
                    boxShadow: alert ? "0 0 40px rgba(210,90,90,.5)" : "0 0 40px rgba(76,194,126,.45)",
                  }}
                >
                  {alert ? <TriangleAlert className="size-9" /> : <CheckCheck className="size-9" />}
                </span>
              </div>
            </div>
            <Foot
              label="Ирц бөглөөгүй хичээл"
              value={unfilled ?? <Dash />}
              tint={alert ? "#FBEAEA" : "#EAF5EE"}
              sub={
                alert && firstUnfilled ? (
                  <Link
                    to={`/teacher/attendance/${firstUnfilled.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-20 inline-flex min-h-11 items-center rounded-full bg-danger px-3.5 text-white"
                  >
                    Бөглөх
                  </Link>
                ) : unfilled === 0 ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Сайн байна
                  </span>
                ) : null
              }
            />
          </div>
        );
      },
    },
  ];

  return <ArcStage cards={cards} initial={2} ariaLabel="Өнөөдрийн тойм" />;
}
