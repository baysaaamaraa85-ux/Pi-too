import { Bell, LogOut, Search } from "lucide-react";
import * as React from "react";
import { Link, useNavigate } from "react-router";
import { useTeacherDashboard } from "@/features/dashboard/dashboard-api";
import { formatDate, formatTime } from "@/shared/format/date";

// Багшийн компьютерийн дээд мөр: сурагч хайх, сануулгын хонх, гарах.
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

function StudentSearch() {
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      className="relative w-full max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        void navigate(text ? `/teacher/students?q=${encodeURIComponent(text)}` : "/teacher/students");
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-[18px] -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Сурагч хайх"
        placeholder="Сурагч хайх..."
        className="h-11 w-full rounded-2xl border border-border-warm bg-white/80 pl-11 pr-4 text-sm text-foreground shadow-soft backdrop-blur placeholder:text-muted focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
      />
    </form>
  );
}

// Хонх: ирц бөглөөгүй хичээл, эцэг эхтэй уулзах сануулга. Байвал улаан цэг гарна.
function ReminderBell() {
  const dash = useTeacherDashboard();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);

  const unfilled = dash.data?.unfilledLessons ?? [];
  const tasks = dash.data?.tasks ?? [];
  const count = unfilled.length + tasks.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={count > 0 ? `Сануулга: ${count}` : "Сануулга"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-11 place-items-center rounded-2xl text-primary transition-colors hover:bg-white/70"
        data-testid="reminder-bell"
      >
        <Bell className="size-[22px]" />
        {count > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-danger ring-2 ring-white" data-testid="bell-dot" />
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Сануулга"
          className="absolute right-0 top-14 z-50 w-80 rounded-2xl border border-border-warm bg-white p-3 shadow-lg"
        >
          {count === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted">Шинэ сануулга алга.</p>
          ) : (
            <ul className="grid gap-1.5">
              {unfilled.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/teacher/attendance/${l.id}`}
                    onClick={close}
                    className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 hover:bg-background-soft"
                  >
                    <span className="text-sm font-bold text-foreground-strong">Ирц бөглөөгүй хичээл</span>
                    <span className="text-xs text-muted">
                      {formatDate(l.startsAt)} {formatTime(l.startsAt)} · {l.branchName}
                    </span>
                  </Link>
                </li>
              ))}
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/teacher/students/${t.studentId}`}
                    onClick={close}
                    className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 hover:bg-background-soft"
                  >
                    <span className="text-sm font-bold text-foreground-strong">
                      {t.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт"}
                    </span>
                    <span className="text-xs text-muted">{t.studentName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TeacherTopBar({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="sticky top-0 z-30 hidden items-center justify-between gap-4 bg-[#fbf1ea]/60 px-8 py-3 backdrop-blur-md md:flex">
      <StudentSearch />
      <div className="flex items-center gap-2">
        <ReminderBell />
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border-warm bg-white/80 px-5 text-sm font-semibold text-primary shadow-soft transition-colors hover:bg-white"
        >
          <LogOut className="size-4" />
          Гарах
        </button>
      </div>
    </div>
  );
}
