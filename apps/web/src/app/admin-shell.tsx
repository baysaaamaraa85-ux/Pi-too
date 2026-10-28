import { ROLE_LABELS } from "@pitoo/contracts";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  School,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/ui/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Шинэ шаардлага 1.1: компьютерт зориулсан хажуугийн цэс, бичвэртэй.
export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Самбар", icon: LayoutDashboard, end: true },
  { to: "/admin/teachers", label: "Багш нар", icon: School },
  { to: "/admin/students", label: "Сурагчид", icon: Users },
  { to: "/admin/parents", label: "Эцэг эхчүүд", icon: UserRound },
  { to: "/admin/classes", label: "Анги ба хуваарь", icon: CalendarDays },
  { to: "/admin/attendance", label: "Ирц", icon: ClipboardCheck },
  { to: "/admin/payroll", label: "Цалин", icon: Wallet },
  { to: "/admin/payments", label: "Төлбөр", icon: CreditCard },
  { to: "/admin/requests", label: "Хүсэлтүүд", icon: ClipboardList },
  { to: "/admin/notifications", label: "Мэдэгдэл", icon: Bell },
  { to: "/admin/reports", label: "Тайлан", icon: FileBarChart },
  { to: "/admin/audit", label: "Аудит", icon: History },
  { to: "/admin/catalog", label: "Тохиргоо", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Админы цэс" className="grid gap-0.5">
      {ADMIN_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-mid transition-colors hover:bg-background-soft hover:text-primary",
              isActive && "bg-primary/8 text-primary",
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;

  const logoutButton = (
    <button
      type="button"
      onClick={() => void logout()}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-warm bg-surface px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/6"
    >
      <LogOut className="size-4" />
      Гарах
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-warm bg-white md:flex">
        <div className="flex h-16 items-center border-b border-border-warm px-5">
          <Logo to="/admin" label={ROLE_LABELS[user.role]} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList />
        </div>
        <div className="border-t border-border-warm p-3">{logoutButton}</div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border-warm bg-white/95 px-4 backdrop-blur-md md:hidden">
        <Logo to="/admin" label={ROLE_LABELS[user.role]} />
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            aria-label="Цэс нээх"
            className="grid size-11 place-items-center rounded-xl text-primary hover:bg-background-soft"
          >
            <Menu className="size-6" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white p-3 shadow-lg">
              <Dialog.Title className="sr-only">Админы цэс</Dialog.Title>
              <Dialog.Description className="sr-only">Хэсгүүд рүү шилжих</Dialog.Description>
              <div className="mb-2 flex justify-end">
                <Dialog.Close
                  aria-label="Цэс хаах"
                  className="grid size-11 place-items-center rounded-xl text-muted hover:bg-background-soft"
                >
                  <X className="size-5" />
                </Dialog.Close>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
              <div className="pt-3">{logoutButton}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <main className="px-4 pb-14 pt-6 sm:px-7 md:ml-64 md:px-10 md:pt-9">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
