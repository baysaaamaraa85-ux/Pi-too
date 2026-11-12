import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import * as React from "react";
import { Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/shared/api-client/client";
import type { ClaimDto } from "@pitoo/contracts";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { HeroWaves } from "@/shared/ui/hero-art";
import { Logo } from "@/shared/ui/logo";
import { AppSidebar, SidebarNav, type NavItem } from "./app-sidebar";
import { AppTopBar, ReminderBell, SearchBox, type BellItem } from "./app-topbar";

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

// Хонх: шинэ түвшин тогтоох хүсэлт, баталгаажуулах төлбөрийн мэдэгдэл.
function AdminBell() {
  const requests = useQuery({
    queryKey: ["placement-requests", "NEW"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests?status=NEW"),
  });
  const claims = useQuery({
    queryKey: ["claims", "PENDING"],
    queryFn: () => api.get<ClaimDto[]>("/payment-claims?status=PENDING"),
  });
  const items: BellItem[] = [];
  const r = requests.data?.length ?? 0;
  const c = claims.data?.length ?? 0;
  if (r > 0) items.push({ key: "requests", to: "/admin/requests", title: `Шинэ хүсэлт: ${r}`, detail: "Түвшин тогтоох цагийн хүсэлт" });
  if (c > 0) items.push({ key: "claims", to: "/admin/payments", title: `Төлбөрийн мэдэгдэл: ${c}`, detail: "Баталгаажуулах хүлээгдэж буй" });
  return <ReminderBell items={items} />;
}

export function AdminShell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  React.useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;

  return (
    <div className="luxury-bg app-zoom relative min-h-screen md:pl-64">
      <HeroWaves className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 w-full [mask-image:linear-gradient(to_bottom,black_55%,transparent)] md:left-64 md:w-[calc(100%-16rem)]" />

      <AppSidebar
        items={ADMIN_NAV}
        ariaLabel="Админы цэс"
        logoTo="/admin"
        logoLabel="Пи тоо"
        userName={user.displayName ?? ""}
        roleLabel="Захирал"
        onLogout={() => void logout()}
      />

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border-warm bg-white/95 px-4 backdrop-blur-md md:hidden">
        <Logo to="/admin" label="Админ" />
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
                <SidebarNav items={ADMIN_NAV} ariaLabel="Админы цэс" onNavigate={() => setOpen(false)} />
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-warm bg-surface px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/6"
                >
                  <LogOut className="size-4" />
                  Гарах
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>

      <AppTopBar
        left={<SearchBox placeholder="Сурагч хайх..." ariaLabel="Сурагч хайх" to="/admin/students" />}
        bell={<AdminBell />}
        onLogout={() => void logout()}
      />

      <main className="relative z-10 mx-auto max-w-[96rem] px-4 pb-14 pt-6 sm:px-7 md:px-8 md:pb-8 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
