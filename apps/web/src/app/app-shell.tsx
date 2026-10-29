import type { Role } from "@pitoo/contracts";
import { ROLE_LABELS } from "@pitoo/contracts";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  School,
  Settings,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Утасны доод навигацид таваас хэтрэхгүй (design 5.5.1).
const NAV: Record<Role, NavItem[]> = {
  TEACHER: [
    { to: "/teacher", label: "Өнөөдөр", icon: LayoutDashboard, end: true },
    { to: "/teacher/calendar", label: "Хуваарь", icon: CalendarDays },
    { to: "/teacher/classes", label: "Анги", icon: School },
    { to: "/teacher/students", label: "Сурагчид", icon: Users },
    { to: "/teacher/enroll", label: "Бүртгэл", icon: UserPlus },
  ],
  ADMIN: [
    { to: "/admin", label: "Самбар", icon: LayoutDashboard, end: true },
    { to: "/admin/requests", label: "Хүсэлт", icon: ClipboardList },
    { to: "/admin/enroll", label: "Бүртгэл", icon: UserPlus },
    { to: "/admin/users", label: "Хэрэглэгч", icon: Users },
    { to: "/admin/catalog", label: "Тохиргоо", icon: Settings },
  ],
  PARENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutDashboard, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Ирц", icon: ClipboardCheck },
    { to: "/portal/payment", label: "Төлбөр", icon: Wallet },
  ],
  STUDENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutDashboard, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Миний ирц", icon: ClipboardCheck },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV[user.role];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-background to-[140px]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border-warm bg-white/90 px-4 backdrop-blur-md sm:px-8">
        <div className="flex items-center gap-8">
          <Logo to={items[0]?.to ?? "/"} label={ROLE_LABELS[user.role]} />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Үндсэн цэс">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-3.5 py-2 text-sm font-semibold text-mid transition-colors hover:bg-background-soft hover:text-primary",
                    isActive && "bg-primary/8 text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex items-center gap-2 rounded-xl border border-border-warm bg-surface px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/6"
        >
          <LogOut className="size-4" />
          <span className="max-sm:sr-only">Гарах</span>
        </button>
      </header>

      <main className="mx-auto max-w-270 px-4 pb-28 pt-6 sm:px-7 md:pb-14 md:pt-9">
        <Outlet />
      </main>

      {items.length > 1 ? (
        <nav
          aria-label="Үндсэн цэс"
          className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border-warm bg-white/95 backdrop-blur-md md:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold text-muted",
                  isActive && "text-primary",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="mb-1.5 font-display text-[clamp(1.7rem,2.4vw,2.2rem)] font-bold text-foreground-strong">
          {title}
        </h1>
        {subtitle ? <p className="text-[0.95rem] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
