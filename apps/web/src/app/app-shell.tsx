import type { Role } from "@pitoo/contracts";
import { ROLE_LABELS } from "@pitoo/contracts";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  LogOut,
  School,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { useAuth, type AuthUser } from "@/features/auth/auth-context";
import { usePortalSummary } from "@/features/portal/portal-api";
import { OfflineBanner } from "@/shared/offline/sync";
import { ShellBackdrop } from "@/shared/ui/hero-art";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";
import { formatHours } from "@/shared/format/hours";
import { useOwnTeacherProfile } from "@/features/public/public-api";
import { AppSidebar, type NavItem } from "./app-sidebar";
import { AppTopBar, ReminderBell, type BellItem } from "./app-topbar";
import { TeacherTopBar } from "./teacher-topbar";

// Утасны доод навигацид таваас хэтрэхгүй (design 5.5.1). Компьютерт хажуугийн цэс.
const NAV: Record<Exclude<Role, "ADMIN">, NavItem[]> = {
  TEACHER: [
    { to: "/teacher", label: "Өнөөдөр", icon: LayoutDashboard, end: true },
    { to: "/teacher/calendar", label: "Хуваарь", icon: CalendarDays },
    { to: "/teacher/classes", label: "Анги", icon: School },
    { to: "/teacher/students", label: "Сурагчид", icon: Users },
    { to: "/teacher/salary", label: "Цалин", icon: Wallet },
  ],
  PARENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutDashboard, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Ирц", icon: ClipboardCheck },
    { to: "/portal/payment", label: "Төлбөр", icon: Wallet },
    { to: "/portal/settings", label: "Мэдэгдэл", icon: Bell },
  ],
  STUDENT: [
    { to: "/portal", label: "Нүүр", icon: LayoutDashboard, end: true },
    { to: "/portal/schedule", label: "Хуваарь", icon: CalendarDays },
    { to: "/portal/attendance", label: "Миний ирц", icon: ClipboardCheck },
  ],
};

// Эцэг эх, сурагчийн хажуугийн цэс: карт дээр нэр, эцэг эхэд "Хүүхэд: ..." гэж харагдана.
function PortalSidebar({
  items,
  user,
  onLogout,
}: {
  items: NavItem[];
  user: AuthUser;
  onLogout: () => void;
}) {
  const summary = usePortalSummary();
  const kids = summary.data?.students.map((s) => s.fullName) ?? [];
  const isParent = user.role === "PARENT";
  return (
    <AppSidebar
      items={items}
      ariaLabel="Үндсэн цэс"
      logoTo="/portal"
      logoLabel={ROLE_LABELS[user.role]}
      userName={isParent ? "Эцэг эх" : (user.displayName ?? kids[0] ?? "Сурагч")}
      roleLabel={isParent ? (kids.length > 0 ? `Хүүхэд: ${kids.join(", ")}` : "Хүүхэдгүй") : "Сурагч"}
      onLogout={onLogout}
      passwordLink
    />
  );
}

// Эцэг эхийн хонх: багц дуусах дөхсөн (үлдэгдэл 3 ба түүнээс бага) хүүхэд.
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
  return <ReminderBell items={items} />;
}

// Багшийн хажуугийн цэс: өөрийн профайлын зураг, "Миний профайл" холбоос.
function TeacherSidebar({
  items,
  user,
  onLogout,
}: {
  items: NavItem[];
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  onLogout: () => void;
}) {
  const profile = useOwnTeacherProfile(user.id);
  return (
    <AppSidebar
      items={items}
      ariaLabel="Багшийн цэс"
      logoTo="/teacher"
      logoLabel="Багш"
      userName={user.displayName ?? ""}
      roleLabel={ROLE_LABELS[user.role]}
      onLogout={onLogout}
      avatarUrl={profile?.photoUrl ?? null}
      profileTo="/teacher/profile"
    />
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  if (!user || user.role === "ADMIN") return null;
  const items = NAV[user.role];
  const isTeacher = user.role === "TEACHER";
  const isParent = user.role === "PARENT";
  const onLogout = () => void logout();

  return (
    <div className="luxury-bg app-zoom relative min-h-screen md:pl-64">
      <ShellBackdrop />

      {isTeacher ? (
        <TeacherSidebar items={items} user={user} onLogout={onLogout} />
      ) : (
        <PortalSidebar items={items} user={user} onLogout={onLogout} />
      )}

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border-warm bg-white/90 px-4 backdrop-blur-md sm:px-8 md:hidden">
        <Logo to={items[0]?.to ?? "/"} label={ROLE_LABELS[user.role]} />
        <div className="flex items-center gap-2">
          <NavLink
            to="/change-password"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-warm bg-surface px-3.5 py-2 text-sm font-semibold text-mid transition-colors hover:bg-primary/6"
          >
            <KeyRound className="size-4" />
            <span className="max-sm:sr-only">Нууц үг</span>
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-warm bg-surface px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/6"
          >
            <LogOut className="size-4" />
            <span className="max-sm:sr-only">Гарах</span>
          </button>
        </div>
      </header>

      {isTeacher ? (
        <TeacherTopBar onLogout={onLogout} />
      ) : (
        <AppTopBar bell={isParent ? <ParentBell /> : undefined} dateChip onLogout={onLogout} />
      )}

      <OfflineBanner />

      <main className="relative z-10 mx-auto max-w-[96rem] px-4 pb-28 pt-6 sm:px-7 md:px-8 md:pb-8 md:pt-0">
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
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted",
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
    <div className="relative z-10 mb-5 flex flex-wrap items-end justify-between gap-3 md:pt-2">
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-[clamp(1.7rem,2.6vw,2.4rem)] font-black leading-tight text-foreground-strong">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-mid">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
