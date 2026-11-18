import { ROLE_LABELS } from "@pitoo/contracts";
import { Bell, CalendarDays, ClipboardCheck, KeyRound, LayoutGrid, LogOut, Wallet, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { usePortalSummary } from "@/features/portal/portal-api";
import { formatDate, weekdayName, weekdayOf } from "@/shared/format/date";
import { formatHours } from "@/shared/format/hours";
import { OfflineBanner } from "@/shared/offline/sync";
import "@/shared/pt/pt.css";
import { cn } from "@/shared/ui/utils";
import { ReminderBell, type BellItem } from "./app-topbar";

// Эцэг эх, сурагчийн бүрхүүл (D-89, parent_home_v3.html): зүүн талд хөвөх шилэн хажуугийн цэс, дээд мөрөнд огноо, хонх, гарах.
// Утсанд доод шилэн цэс. Цэсний бичвэр, зам өмнөхтэй ижил.
interface PortalNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<"PARENT" | "STUDENT", PortalNavItem[]> = {
  PARENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutGrid, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Ирц", icon: ClipboardCheck },
    { to: "/portal/payment", label: "Төлбөр", icon: Wallet },
    { to: "/portal/settings", label: "Мэдэгдэл", icon: Bell },
  ],
  STUDENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutGrid, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Миний ирц", icon: ClipboardCheck },
  ],
};

// Эцэг эхийн хонх: багц дуусах дөхсөн (үлдэгдэл 9 цаг ба түүнээс бага) хүүхэд.
function ParentBell() {
  const summary = usePortalSummary();
  const items: BellItem[] = [];
  for (const student of summary.data?.students ?? []) {
    for (const c of student.contracts) {
      if (c.status === "ACTIVE" && c.remainingHours <= 9) {
        items.push({
          key: c.id,
          to: "/portal",
          title: "Багц дуусах дөхсөн",
          detail: `${student.fullName}: ${c.programName}, үлдэгдэл ${formatHours(c.remainingHours)} цаг`,
        });
      }
    }
  }
  return <ReminderBell items={items} glass />;
}

const iconButton =
  "pt-glass grid size-11 shrink-0 place-items-center rounded-full text-ink-600 transition-colors hover:bg-white hover:text-brand-700 motion-reduce:transition-none";

export function PortalShell() {
  const { user, logout } = useAuth();
  const summary = usePortalSummary();
  const [now] = React.useState(() => new Date());
  if (!user || (user.role !== "PARENT" && user.role !== "STUDENT")) return null;

  const items = NAV[user.role];
  const isParent = user.role === "PARENT";
  const kids = summary.data?.students.map((s) => s.fullName) ?? [];
  const name = isParent ? "Эцэг эх" : (user.displayName ?? kids[0] ?? "Сурагч");
  const role = isParent ? (kids.length > 0 ? `Хүүхэд: ${kids.join(", ")}` : "Хүүхэдгүй") : ROLE_LABELS[user.role];
  const onLogout = () => void logout();

  return (
    <div className="pt-ui relative min-h-screen overflow-x-clip bg-paper text-ink-900">
      <div
        className="pointer-events-none fixed -right-60 -top-80 z-0 size-[760px] rounded-full"
        style={{ background: "radial-gradient(closest-side,rgba(139,26,26,.14),transparent)" }}
        aria-hidden="true"
      />

      {/* Компьютер: хөвөх шилэн хажуугийн цэс */}
      <aside className="pt-glass fixed bottom-4 left-4 top-4 z-40 hidden w-[248px] flex-col rounded-[28px] p-3 lg:flex">
        <Link to="/portal" className="flex items-center gap-3 px-2 pb-5 pt-1.5" aria-label={`Пи тоо, ${ROLE_LABELS[user.role]}`}>
          <span className="grid size-11 place-items-center rounded-[14px] bg-brand-700 text-xl font-semibold text-white shadow-[0_8px_20px_-8px_rgba(139,26,26,0.7)]">
            π
          </span>
          <span className="leading-tight">
            <span className="pt-tight block text-[17px] font-semibold">Пи тоо</span>
            <span className="block text-[12px] font-medium text-ink-500">{ROLE_LABELS[user.role]}</span>
          </span>
        </Link>
        <nav aria-label="Үндсэн цэс" className="flex-1 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] font-medium transition-colors motion-reduce:transition-none",
                  isActive
                    ? "bg-brand-700 text-white shadow-[0_10px_22px_-10px_rgba(139,26,26,0.7)]"
                    : "text-ink-600 hover:bg-white/80 hover:text-ink-900",
                )
              }
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/change-password"
          className="mb-2 flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] font-medium text-ink-600 transition-colors hover:bg-white/80 hover:text-ink-900"
        >
          <KeyRound className="size-[18px]" aria-hidden="true" />
          Нууц үг солих
        </Link>
        <div className="flex items-center gap-3 rounded-[18px] border border-paper-3 bg-white/80 p-2">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 via-brand-400 to-brand-800 font-semibold text-white"
            aria-hidden="true"
          >
            {name.trim().charAt(0).toUpperCase() || "π"}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-semibold" data-testid="sidebar-name">
              {name}
            </span>
            <span className="block truncate text-[12px] text-ink-500">{role}</span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Гарах"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Утас: доод шилэн цэс */}
      {items.length > 1 ? (
        <nav aria-label="Үндсэн цэс" className="pt-glass fixed inset-x-3 bottom-3 z-40 flex justify-between rounded-full p-1.5 lg:hidden">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) =>
                cn("grid h-12 flex-1 place-items-center rounded-full", isActive ? "bg-brand-700 text-white" : "text-ink-500")
              }
            >
              <item.icon className="size-5" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
      ) : null}

      <main className="relative z-10 pb-28 lg:pb-12 lg:pl-[280px]">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
          <header className="flex items-center justify-between gap-3 pt-5 lg:pt-7">
            <Link to="/portal" className="flex min-h-11 items-center gap-2.5 lg:hidden" aria-label="Пи тоо">
              <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 font-semibold text-white">π</span>
              <span className="pt-tight font-semibold">Пи тоо</span>
            </Link>
            <span className="hidden lg:block" />
            <div className="flex items-center gap-2">
              <span className="pt-glass pt-num hidden h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_4px_rgba(29,122,70,0.15)]" aria-hidden="true" />
                {formatDate(now)} · {weekdayName(weekdayOf(now))}
              </span>
              {isParent ? <ParentBell /> : null}
              <Link to="/change-password" aria-label="Нууц үг" className={cn(iconButton, "lg:hidden")}>
                <KeyRound className="size-[17px]" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Гарах"
                className="pt-glass inline-flex h-11 w-11 items-center justify-center gap-2 rounded-full text-[14px] font-medium text-brand-700 transition-colors hover:bg-white sm:w-auto sm:px-4"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Гарах</span>
              </button>
            </div>
          </header>
          <OfflineBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
