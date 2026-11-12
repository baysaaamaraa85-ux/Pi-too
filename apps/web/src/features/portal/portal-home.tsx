import { ASSESSMENT_TYPE_LABELS } from "@pitoo/contracts";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  PencilLine,
  Package,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { useProgress } from "@/features/progress/progress-parts";
import { useLessons } from "@/features/schedule/lessons";
import {
  addDaysToKey,
  formatDate,
  formatTime,
  localDateKey,
  weekdayName,
  weekdayOf,
} from "@/shared/format/date";
import { Panel } from "@/shared/ui/dash";
import { cn } from "@/shared/ui/utils";
import { usePortalSummary } from "./portal-api";
import { ChildPicker, EmptyNote, PortalLoading, useSelectedChild } from "./portal-parts";

function Bar({ percent }: { percent: number }) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover" style={{ width: `${value}%` }} />
    </div>
  );
}

// compact=true бол утсанд (sm-ээс бага) нуугдана: дөрвөн үзүүлэлт нэг дэлгэцэнд багтахын тулд.
function IconTile({ icon: Icon, compact = false }: { icon: LucideIcon; compact?: boolean }) {
  return (
    <span
      className={cn(
        "size-11 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary",
        compact ? "hidden sm:grid" : "grid",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function LinkCard({ to, icon, title, text }: { to: string; icon: LucideIcon; title: string; text: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-border-warm bg-surface p-4 shadow-soft transition-colors hover:border-primary/30 sm:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
        {(() => {
          const Icon = icon;
          return <Icon className="size-6" />;
        })()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-bold leading-snug text-foreground-strong">{title}</span>
        <span className="block text-[0.82rem] leading-snug text-muted">{text}</span>
      </span>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/8 text-primary">
        <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}

// ФШ-65, 66: эцэг эх, сурагчийн нүүр. Дөрвөн үзүүлэлт: дараагийн хичээл, багцын үлдэгдэл, чөлөөний эрх,
// сүүлийн сорил. Төлбөрийн холбоос зөвхөн эцэг эхэд.
export function PortalHomePage() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const summary = usePortalSummary();
  const { selected, select } = useSelectedChild(summary.data?.students);
  const today = localDateKey(new Date());
  const lessons = useLessons(addDaysToKey(today, -1), addDaysToKey(today, 29));
  const progress = useProgress(selected?.studentId ?? "");
  const students = summary.data?.students ?? [];

  const contract = selected?.contracts.find((c) => c.status === "ACTIVE") ?? selected?.contracts[0];
  const classIds = new Set((selected?.contracts ?? []).flatMap((c) => c.classes.map((cls) => cls.id)));
  const now = Date.now();
  const next = lessons.data?.find(
    (l) => classIds.has(l.classId) && l.status === "SCHEDULED" && new Date(l.startsAt).getTime() > now,
  );
  const assessments = progress.data?.assessments ?? [];
  const last = assessments[assessments.length - 1];
  const lastPercent = last ? Number(last.totalPercent) : null;
  const firstName = (selected?.fullName ?? user?.displayName ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <header className="relative z-10 mb-3 pt-0 md:mb-4 md:pt-2">
        {isParent ? (
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Таны хүүхэд</p>
        ) : null}
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.7rem)] font-black leading-tight text-foreground-strong">
          {isParent ? (selected?.fullName ?? "Таны хүүхэд") : `Сайн уу, ${firstName || "сурагч"}`}
        </h1>
        <p className="mt-1 text-sm text-mid">Багц, чөлөө, дараагийн хичээл</p>
      </header>

      <PortalLoading query={summary} />
      {summary.data && students.length === 0 ? (
        <EmptyNote>
          {isParent
            ? "Таны данстай холбогдсон сурагч алга байна. Төвтэй холбогдоно уу."
            : "Таны данстай холбогдсон бүртгэл алга байна. Төвтэй холбогдоно уу."}
        </EmptyNote>
      ) : null}
      <ChildPicker students={students} selectedId={selected?.studentId} onSelect={select} />

      {selected ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-4" data-testid="portal-stats">
            <Panel className="relative z-20 flex flex-col justify-between gap-2 p-3.5 sm:gap-3 sm:p-5 lg:row-span-2" data-testid="stat-next-lesson">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-mid">
                <IconTile icon={Clock} compact /> Дараагийн хичээл
              </p>
              <div>
                <p className="font-display text-[clamp(2.3rem,6vw,4.4rem)] font-bold leading-none tabular-nums text-foreground-strong">
                  {next ? formatTime(next.startsAt) : "Алга"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {next
                    ? `${weekdayName(weekdayOf(next.startsAt))}, ${formatDate(next.startsAt)}`
                    : "Товлогдсон хичээл алга"}
                </p>
              </div>
              <Link
                to="/portal/schedule"
                className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-hover px-5 text-sm font-bold text-primary-foreground shadow-md"
              >
                Хуваарь харах <ChevronRight className="size-4" />
              </Link>
            </Panel>

            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <Panel className="relative z-20 grid content-between gap-2 p-3.5 sm:p-5" data-testid="stat-remaining">
                <div className="flex items-start gap-3">
                  <IconTile icon={Package} compact />
                  <div className="min-w-0">
                    <p className="font-display text-3xl font-bold leading-none tabular-nums text-foreground-strong">
                      {contract ? contract.remainingVisits : "-"}
                      {contract ? (
                        <span className="ml-1 text-base font-semibold text-muted"> / {contract.totalVisits}</span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 text-[0.8rem] leading-snug text-muted">Багцын үлдэгдэл</p>
                  </div>
                </div>
                {contract ? <Bar percent={(contract.remainingVisits / Math.max(1, contract.totalVisits)) * 100} /> : null}
                <p className="truncate text-[0.8rem] text-muted">{contract?.programName ?? "Багц алга"}</p>
              </Panel>

              <Panel className="relative z-20 grid content-between gap-1 p-3.5 sm:gap-2 sm:p-5" data-testid="stat-leaves">
                <div className="flex items-start gap-3">
                  <IconTile icon={CalendarDays} compact />
                  <div className="min-w-0">
                    <p className="font-display text-3xl font-bold leading-none tabular-nums text-foreground-strong">
                      {contract ? contract.leavesLeft : "-"}
                    </p>
                    <p className="mt-1.5 text-[0.8rem] leading-snug text-muted">Чөлөөний эрх</p>
                  </div>
                </div>
                <Link
                  to="/portal/attendance"
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {isParent ? "Ирцийн түүх" : "Чөлөө хүсэх"} <ChevronRight className="size-4" />
                </Link>
                {contract && contract.freeReviewsLeft > 0 ? (
                  <p className="text-[0.78rem] text-muted">Үнэгүй давтлага: {contract.freeReviewsLeft}</p>
                ) : null}
              </Panel>

              <Panel className="relative z-20 col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 p-3.5 sm:p-5" data-testid="stat-last-assessment">
                <div className="flex items-center gap-3">
                  <IconTile icon={PencilLine} compact />
                  <div>
                    <p className="font-display text-3xl font-bold leading-none tabular-nums text-foreground-strong">
                      {lastPercent === null ? "Алга" : `${Math.round(lastPercent)}%`}
                    </p>
                    <p className="mt-1.5 text-[0.8rem] leading-snug text-muted">Сүүлийн сорил</p>
                  </div>
                </div>
                <div className={cn("min-w-[10rem] flex-1 grid gap-1.5", lastPercent === null && "hidden")}>
                  <Bar percent={lastPercent ?? 0} />
                  <p className="text-[0.8rem] text-muted">
                    {last ? `${ASSESSMENT_TYPE_LABELS[last.type]}, ${formatDate(last.takenOn)}` : ""}
                  </p>
                </div>
              </Panel>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
            <LinkCard
              to="/portal/schedule"
              icon={CalendarDays}
              title={isParent ? "Хүүхдийн хуваарь" : "Миний хуваарь"}
              text="Дараагийн 4 долоо хоногийн хичээл"
            />
            <LinkCard
              to="/portal/attendance"
              icon={ClipboardCheck}
              title={isParent ? "Хүүхдийн ирц, дүн" : "Миний ирц, дүн"}
              text="Ирцийн түүх, дүнгийн график, чөлөө хүсэх"
            />
            {isParent ? (
              <LinkCard to="/portal/payment" icon={Wallet} title="Гэрээ, төлбөр" text="Төлбөр шилжүүлэх заавар" />
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
