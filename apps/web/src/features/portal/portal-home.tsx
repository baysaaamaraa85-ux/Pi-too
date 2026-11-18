import type { TeacherProgressPointDto } from "@pitoo/contracts";
import { ArrowRight, ArrowUpRight, CalendarDays, ClipboardCheck, Clock3, Globe, Package, PencilLine, Ticket, Wallet, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { assessmentTitle, useProgress } from "@/features/progress/progress-parts";
import { DarkTrend } from "@/features/progress/dark-trend";
import { useLessons } from "@/features/schedule/lessons";
import { addDaysToKey, formatDate, formatTime, localDateKey, weekdayName, weekdayOf } from "@/shared/format/date";
import { formatHours } from "@/shared/format/hours";
import { Reveal } from "@/shared/pt/motion";
import "@/shared/pt/pt.css";
import { cn } from "@/shared/ui/utils";
import { usePortalSummary } from "./portal-api";
import { ChildPicker, EmptyNote, PortalLoading, useSelectedChild } from "./portal-parts";

// ФШ-65, 66: эцэг эх, сурагчийн нүүр (D-89, parent_home_v3.html). Дөрвөн үзүүлэлт: дараагийн хичээл, багцын үлдэгдэл, чөлөөний эрх,
// сүүлийн сорил. ФШ-65: 360 px өргөнтэй дэлгэцэнд гүйлгэхгүйгээр дөрвөн үзүүлэлт харагдах ёстой тул утсанд нягт байрлалтай (e2e 09-portal).
// Төлбөрийн холбоос зөвхөн эцэг эхэд (ФШ-66).

const MAX_TICKETS = 6;

// Дараагийн хичээл хүртэлх хугацаа: "2 өдөр 3 цаг", "5 цаг 10 мин", "20 мин"
function countdown(ms: number) {
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d} өдөр ${h} цаг` : h > 0 ? `${h} цаг ${m} мин` : `${m} мин`;
}

function useNow(everyMs = 30_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

// Анхны зурагдалтад нэг удаа true болно (цагираг, зураас дүүрэх хөдөлгөөнд)
function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}

const card = "rounded-[28px] border border-paper-3 bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-14px_rgba(23,23,23,0.12)]";

function LinkCard({ to, icon: Icon, title, text, hue, tint, delay }: { to: string; icon: LucideIcon; title: string; text: string; hue: string; tint: string; delay: number }) {
  return (
    <Reveal delay={delay} className="pt-lib group flex" style={{ "--tint": tint } as React.CSSProperties}>
      <Link to={to} className="flex w-full flex-col">
        <div className="pt-cover pt-dark grid h-[110px] place-items-center">
          <div className="pt-glow" style={{ background: `radial-gradient(40% 50% at 50% 55%,rgba(${hue},.55),transparent 70%)` }} />
          <div className="pt-dots" />
          <div className="pt-noise" />
          <span
            className="relative grid size-14 place-items-center rounded-[18px] text-white transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
            style={{
              background: "linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.22)",
              boxShadow: `0 0 36px rgba(${hue},.55),inset 0 1px 0 rgba(255,255,255,.3)`,
            }}
            aria-hidden="true"
          >
            <Icon className="size-6" />
          </span>
        </div>
        <div className="pt-meta flex flex-1 items-center justify-between gap-3 px-5 py-4">
          <span>
            <span className="block text-[16px] font-semibold">{title}</span>
            <span className="mt-0.5 block text-[13px] text-ink-500">{text}</span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-paper-3 bg-white text-ink-500 transition group-hover:border-brand-700 group-hover:bg-brand-700 group-hover:text-white" aria-hidden="true">
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

export function PortalHomePage() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const summary = usePortalSummary();
  const { selected, select } = useSelectedChild(summary.data?.students);
  const now = useNow();
  const mounted = useMounted();
  const [today] = React.useState(() => localDateKey(new Date()));
  const lessons = useLessons(addDaysToKey(today, -1), addDaysToKey(today, 29));
  const progress = useProgress(selected?.studentId ?? "");
  const students = summary.data?.students ?? [];

  const contract = selected?.contracts.find((c) => c.status === "ACTIVE") ?? selected?.contracts[0];
  const classIds = new Set((selected?.contracts ?? []).flatMap((c) => c.classes.map((cls) => cls.id)));
  const next = lessons.data?.find((l) => classIds.has(l.classId) && l.status === "SCHEDULED" && new Date(l.startsAt).getTime() > now);
  const assessments = progress.data?.assessments ?? [];
  const last = assessments[assessments.length - 1];
  const lastPercent = last ? Number(last.totalPercent) : null;
  // Багшийн нүүртэй ижил график: сорил бүр нэг цэг (count 1), ижил өдрийн дүнг график дундажилна.
  const trendPoints: TeacherProgressPointDto[] = assessments.map((a) => ({ date: a.takenOn, averagePercent: a.totalPercent, count: 1 }));
  const firstName = (selected?.fullName ?? user?.displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const childName = isParent ? (selected?.fullName ?? "Таны хүүхэд") : firstName || "сурагч";

  const timeText = next ? formatTime(next.startsAt) : "Алга";
  const dayText = next ? weekdayName(weekdayOf(next.startsAt)) : "";
  const dateText = next ? formatDate(next.startsAt) : "Товлогдсон хичээл алга";
  const total = contract ? Math.max(1, contract.totalHours) : 1;
  const leftPercent = contract ? Math.max(0, Math.min(100, (contract.remainingHours / total) * 100)) : 0;
  const ring = 251.3 * (1 - (mounted ? (lastPercent ?? 0) : 0) / 100);

  return (
    <>
      <section className="mt-5 flex flex-col justify-between gap-5 sm:mt-8 md:flex-row md:items-end lg:mt-10">
        <div>
          <p className="pt-word text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-700" style={{ animationDelay: "0.05s", display: "block" }}>
            {isParent ? "Таны хүүхэд" : "Сайн уу"}
          </p>
          <div className="mt-2 flex items-center gap-3 sm:mt-3 sm:gap-4">
            <span
              className="pt-word grid size-12 place-items-center rounded-[16px] bg-brand-700 text-[24px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(139,26,26,0.7)] sm:size-[72px] sm:rounded-[22px] sm:text-[30px]"
              style={{ animationDelay: "0.1s", display: "grid" }}
              aria-hidden="true"
            >
              {childName.trim().charAt(0).toUpperCase()}
            </span>
            <h1 className="pt-word pt-tight text-[36px] font-semibold leading-none sm:text-[60px]" style={{ animationDelay: "0.2s" }}>
              {childName}
            </h1>
          </div>
          <div className="hidden sm:block">
            <p className="pt-word mt-4 text-[15.5px] text-ink-500" style={{ animationDelay: "0.4s" }}>
              Багц, чөлөө, дараагийн хичээл
            </p>
          </div>
        </div>
        {contract ? (
          <span className="hidden h-11 items-center gap-2 self-start rounded-full border border-paper-3 bg-white pl-2 pr-4 text-[13.5px] font-semibold sm:inline-flex md:self-end">
            <span className="grid size-7 place-items-center rounded-full bg-gold-300/30 text-gold-600">
              <Globe className="size-3.5" aria-hidden="true" />
            </span>
            {contract.programName}
          </span>
        ) : null}
      </section>

      <div className="mt-4 empty:hidden sm:mt-6">
        <PortalLoading query={summary} />
        {summary.data && students.length === 0 ? (
          <EmptyNote>
            {isParent
              ? "Таны данстай холбогдсон сурагч алга байна. Төвтэй холбогдоно уу."
              : "Таны данстай холбогдсон бүртгэл алга байна. Төвтэй холбогдоно уу."}
          </EmptyNote>
        ) : null}
      </div>
      <ChildPicker students={students} selectedId={selected?.studentId} onSelect={select} />

      {selected ? (
        <>
          <section className="mt-4 grid grid-cols-2 gap-3 sm:mt-8 lg:grid-cols-12 lg:gap-5" data-testid="portal-stats">
            {/* Дараагийн хичээл */}
            <article
              data-testid="stat-next-lesson"
              className="pt-dark relative col-span-2 flex flex-col overflow-hidden rounded-[28px] bg-[#141110] p-4 text-white sm:rounded-[32px] sm:p-8 lg:col-span-5 lg:row-span-2 lg:min-h-[400px]"
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(65% 55% at 70% 35%,rgba(139,26,26,.7),transparent 70%),radial-gradient(40% 40% at 5% 100%,rgba(242,174,58,.18),transparent 70%)",
                }}
              />
              <div className="pt-dots" />
              <div className="pt-noise" />
              <div className="relative flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-3 text-[12.5px] font-medium text-white/85">
                  <Clock3 className="size-3.5 text-gold-300" aria-hidden="true" />
                  Дараагийн хичээл
                </span>
                {next ? (
                  <span className="pt-num inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-gold-400 px-3 text-[12px] font-bold text-ink-900">
                    {countdown(Date.parse(next.startsAt) - now)}
                  </span>
                ) : null}
              </div>

              {/* Утас: цаг, өдөр нэг мөрөнд нягт */}
              <div className="relative mt-3 flex items-end justify-between gap-3 sm:hidden">
                <div>
                  <div className="pt-tight pt-num text-[44px] font-semibold leading-none" style={{ textShadow: "0 2px 20px rgba(74,10,10,.85)" }}>
                    {timeText}
                  </div>
                  <div className="pt-num mt-1 text-[13px] text-white/70">{next ? `${dayText}, ${dateText}` : dateText}</div>
                </div>
                <Link
                  to="/portal/schedule"
                  className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-brand-800 transition hover:bg-paper-2"
                >
                  Хуваарь харах <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>

              {/* Компьютер, таблет: гэрэлтдэг бөмбөлөг дотор цаг */}
              <div className="relative hidden flex-1 place-items-center py-8 sm:grid">
                <div className="relative grid size-[210px] place-items-center">
                  <div className="pt-orb-ring" style={{ inset: -14 }} aria-hidden="true" />
                  <div className="pt-orb-core absolute inset-[34px]" aria-hidden="true" />
                  <div className="pt-tight pt-num relative text-[54px] font-semibold leading-none" style={{ textShadow: "0 2px 20px rgba(74,10,10,.85)" }}>
                    {timeText}
                  </div>
                </div>
              </div>
              <div className="relative hidden flex-wrap items-end justify-between gap-4 sm:flex">
                <div>
                  <div className="pt-tight text-[22px] font-semibold">{dayText || "Хичээл алга"}</div>
                  <div className="pt-num text-[14px] text-white/60">{dateText}</div>
                </div>
                <Link
                  to="/portal/schedule"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold text-brand-800 transition hover:bg-paper-2"
                >
                  Хуваарь харах <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </article>

            {/* Багцын үлдэгдэл */}
            <article data-testid="stat-remaining" className={cn(card, "flex flex-col p-4 sm:p-6 lg:col-span-4")}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-500">Багцын үлдэгдэл</span>
                <span className="hidden size-9 place-items-center rounded-xl bg-brand-50 text-brand-700 sm:grid">
                  <Package className="size-[18px]" aria-hidden="true" />
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-x-2 sm:mt-4">
                <span className="pt-tight pt-num text-[34px] font-semibold leading-none sm:text-[46px]">{contract ? formatHours(contract.remainingHours) : "-"}</span>
                {contract ? <span className="pt-num pb-0.5 text-[14px] font-semibold text-ink-500 sm:pb-1 sm:text-[17px]">/ {formatHours(contract.totalHours)} цаг</span> : null}
              </div>
              {contract ? (
                <div
                  className="mt-3 h-3.5 overflow-hidden rounded-full bg-paper-2 sm:mt-5"
                  role="progressbar"
                  aria-label="Багцын үлдэгдэл"
                  aria-valuemin={0}
                  aria-valuemax={contract.totalHours}
                  aria-valuenow={contract.remainingHours}
                >
                  <div
                    className="h-full rounded-full bg-brand-700 shadow-[0_0_14px_rgba(139,26,26,0.45)] transition-[width] duration-[1600ms] ease-out motion-reduce:transition-none"
                    style={{ width: `${mounted ? leftPercent : 100}%` }}
                  />
                </div>
              ) : null}
              <p className="mt-auto hidden pt-4 text-[13px] text-ink-500 sm:block">
                {contract ? (
                  <>
                    <span className="pt-num font-semibold text-ink-900">{formatHours(Math.max(0, contract.totalHours - contract.remainingHours))} цаг</span> ашигласан · {contract.programName}
                  </>
                ) : (
                  "Багц алга"
                )}
              </p>
            </article>

            {/* Чөлөөний эрх */}
            <article data-testid="stat-leaves" className={cn(card, "flex flex-col p-4 sm:p-6 lg:col-span-3")}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-500">Чөлөөний эрх</span>
                <span className="hidden size-9 place-items-center rounded-xl bg-gold-300/30 text-gold-600 sm:grid">
                  <CalendarDays className="size-[18px]" aria-hidden="true" />
                </span>
              </div>
              <div className="pt-tight pt-num mt-2 text-[34px] font-semibold leading-none sm:mt-4 sm:text-[46px]">{contract ? contract.leavesLeft : "-"}</div>
              <div className="mt-4 hidden gap-2 sm:flex" aria-hidden="true">
                {Array.from({ length: Math.min(contract?.leavesLeft ?? 0, MAX_TICKETS) }, (_, i) => (
                  <span key={i} className="grid h-7 flex-1 place-items-center rounded-[10px] bg-brand-700 text-white shadow-[0_6px_14px_-6px_rgba(139,26,26,0.7)] sm:h-9">
                    <Ticket className="size-4" />
                  </span>
                ))}
              </div>
              <Link
                to="/portal/attendance"
                className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start pt-1 text-[14px] font-semibold text-brand-700 transition-all hover:gap-2.5 sm:pt-4"
              >
                {isParent ? "Ирцийн түүх" : "Чөлөө хүсэх"} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {contract && contract.freeReviewsLeft > 0 ? <p className="hidden text-[13px] text-ink-500 sm:block">Үнэгүй давтлага: {contract.freeReviewsLeft}</p> : null}
            </article>

            {/* Сүүлийн сорил */}
            <article data-testid="stat-last-assessment" className={cn(card, "col-span-2 flex items-center gap-4 p-4 sm:gap-6 sm:p-6 lg:col-span-7")}>
              <div className="relative size-16 shrink-0 sm:size-24" role="img" aria-label={lastPercent === null ? "Сорил алга" : `Сүүлийн сорил ${Math.round(lastPercent)} хувь`}>
                <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#F3EEE7" strokeWidth="10" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#8B1A1A"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="251.3"
                    strokeDashoffset={ring}
                    style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }}
                  />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-brand-700">
                  <PencilLine className="size-5 sm:size-6" aria-hidden="true" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-ink-500">Сүүлийн сорил</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="pt-tight pt-num text-[34px] font-semibold leading-none sm:text-[44px]">
                    {lastPercent === null ? (
                      "Алга"
                    ) : (
                      <>
                        {Math.round(lastPercent)}
                        <span className="text-[22px] text-ink-300 sm:text-[24px]">%</span>
                      </>
                    )}
                  </span>
                  {last ? <span className="inline-flex h-7 items-center rounded-full bg-paper-2 px-3 text-[12.5px] font-semibold">{assessmentTitle(last)}</span> : null}
                </div>
                {last ? <div className="pt-num mt-1.5 text-[12.5px] text-ink-500 sm:mt-2">{formatDate(last.takenOn)}</div> : null}
              </div>
            </article>
          </section>

          <section className="mt-4 lg:mt-5">
            <Reveal>
              <DarkTrend
                points={trendPoints}
                title={isParent ? "Хүүхдийн ахиц (%)" : "Миний ахиц (%)"}
                chartLabel={isParent ? "Хүүхдийн дундаж ахиц" : "Миний дундаж ахиц"}
              />
            </Reveal>
          </section>

          <section className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 lg:mt-5 lg:gap-5">
            <LinkCard
              to="/portal/schedule"
              icon={CalendarDays}
              title={isParent ? "Хүүхдийн хуваарь" : "Миний хуваарь"}
              text="Дараагийн 4 долоо хоногийн хичээл"
              hue="139,26,26"
              tint="#F6E9E9"
              delay={0}
            />
            <LinkCard
              to="/portal/attendance"
              icon={ClipboardCheck}
              title={isParent ? "Хүүхдийн ирц, дүн" : "Миний ирц, дүн"}
              text="Ирцийн түүх, дүнгийн график, чөлөө хүсэх"
              hue="242,174,58"
              tint="#F8F0E2"
              delay={80}
            />
            {isParent ? (
              <LinkCard to="/portal/payment" icon={Wallet} title="Гэрээ, төлбөр" text="Төлбөр шилжүүлэх заавар" hue="76,194,126" tint="#EAF5EE" delay={160} />
            ) : null}
          </section>
        </>
      ) : null}
    </>
  );
}
