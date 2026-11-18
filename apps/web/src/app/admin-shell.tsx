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
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  School,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { ADMIN_ACTIONS, ADMIN_SETUP } from "@/features/admin/admin-links";
import { api } from "@/shared/api-client/client";
import type { ClaimDto } from "@pitoo/contracts";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import "@/shared/pt/pt.css";
import { cn } from "@/shared/ui/utils";
import { ReminderBell, type BellItem } from "./app-topbar";
import { CommandPalette, type PaletteItem } from "./command-palette";

// Админы бүрхүүл (D-88, admin_dashboard_v2.html): зүүн талд хөвөх шилэн хажуугийн цэс (бүлэглэсэн), дээд талд хайлт (Ctrl K),
// хонх, гарах. Утсанд доод шилэн цэс ба "Бүх цэс" drawer. Цэсний бичвэр, зам өмнөхтэй ижил.
interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const ADMIN_NAV_GROUPS: { group: string; items: AdminNavItem[] }[] = [
  { group: "Үндсэн", items: [{ to: "/admin", label: "Самбар", icon: LayoutGrid, end: true }] },
  {
    group: "Хүмүүс",
    items: [
      { to: "/admin/teachers", label: "Багш нар", icon: School },
      { to: "/admin/students", label: "Сурагчид", icon: Users },
      { to: "/admin/parents", label: "Эцэг эхчүүд", icon: UserRound },
    ],
  },
  {
    group: "Сургалт",
    items: [
      { to: "/admin/classes", label: "Анги ба хуваарь", icon: CalendarDays },
      { to: "/admin/attendance", label: "Ирц", icon: ClipboardCheck },
    ],
  },
  {
    group: "Санхүү",
    items: [
      { to: "/admin/payroll", label: "Цалин", icon: Wallet },
      { to: "/admin/payments", label: "Төлбөр", icon: CreditCard },
    ],
  },
  {
    group: "Систем",
    items: [
      { to: "/admin/requests", label: "Хүсэлтүүд", icon: ClipboardList },
      { to: "/admin/notifications", label: "Мэдэгдэл", icon: Bell },
      { to: "/admin/reports", label: "Тайлан", icon: FileBarChart },
      { to: "/admin/audit", label: "Аудит", icon: History },
      { to: "/admin/catalog", label: "Тохиргоо", icon: Settings },
    ],
  },
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
  return <ReminderBell items={items} glass />;
}

// Бүлэглэсэн цэс (хажуугийн самбар ба drawer-т ижил)
function GroupedNav({ ariaLabel, onNavigate }: { ariaLabel: string; onNavigate?: () => void }) {
  return (
    <nav aria-label={ariaLabel} className="space-y-3">
      {ADMIN_NAV_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-ink-500">{g.group}</div>
          <div className="space-y-0.5">
            {g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex h-10 items-center gap-3 rounded-[14px] px-3 text-[14px] font-medium transition-colors motion-reduce:transition-none",
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
          </div>
        </div>
      ))}
    </nav>
  );
}

const iconButton =
  "grid size-9 shrink-0 place-items-center rounded-full text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700 motion-reduce:transition-none";

function UserBlock({ name, onLogout }: { name: string; onLogout: () => void }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-paper-3 bg-white/80 p-2">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 via-brand-400 to-brand-800 font-semibold text-white"
        aria-hidden="true"
      >
        {name.trim().charAt(0).toUpperCase() || "π"}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="pt-num block truncate text-[14px] font-semibold" data-testid="sidebar-name">
          {name}
        </span>
        <span className="block text-[12px] text-ink-500">Захирал</span>
      </span>
      <Link to="/change-password" aria-label="Нууц үг солих" className={iconButton}>
        <KeyRound className="size-4" aria-hidden="true" />
      </Link>
      <button type="button" onClick={onLogout} aria-label="Гарах" className={iconButton}>
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const BOTTOM = [
  { to: "/admin", label: "Самбар", icon: LayoutGrid, end: true },
  { to: "/admin/teachers", label: "Багш нар", icon: School },
  { to: "/admin/students", label: "Сурагчид", icon: Users },
  { to: "/admin/payments", label: "Төлбөр", icon: CreditCard },
] as const;

export function AdminShell() {
  const { user, logout } = useAuth();
  const [drawer, setDrawer] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Ctrl K (Mac дээр ⌘K): хайлтын цонх нээх, хаах
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!user) return null;
  const name = user.displayName ?? "";
  const onLogout = () => void logout();

  const palette: PaletteItem[] = [
    ...ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ group: "Хуудас", label: i.label, icon: i.icon, to: i.to }))),
    ...ADMIN_ACTIONS.map((a) => ({ group: "Шуурхай үйлдэл", label: a.label, icon: a.icon, to: a.to })),
    ...ADMIN_SETUP.map((a) => ({ group: "Тохиргоо", label: a.label, icon: a.icon, to: a.to })),
  ];

  return (
    <div className="pt-ui relative min-h-screen overflow-x-clip bg-paper text-ink-900">
      <div
        className="pointer-events-none fixed -right-60 -top-80 z-0 size-[760px] rounded-full"
        style={{ background: "radial-gradient(closest-side,rgba(139,26,26,.14),transparent)" }}
        aria-hidden="true"
      />

      {/* Компьютер: хөвөх шилэн хажуугийн цэс */}
      <aside className="pt-glass fixed bottom-4 left-4 top-4 z-40 hidden w-[248px] flex-col rounded-[28px] p-3 lg:flex">
        <Link to="/admin" className="flex items-center gap-3 px-2 pb-4 pt-1.5" aria-label="Пи тоо, Самбар">
          <span className="grid size-11 place-items-center rounded-[14px] bg-brand-700 text-xl font-semibold text-white shadow-[0_8px_20px_-8px_rgba(139,26,26,0.7)]">
            π
          </span>
          <span className="leading-tight">
            <span className="pt-tight block text-[17px] font-semibold">Пи тоо</span>
            <span className="block text-[12px] font-medium text-ink-500">Админ</span>
          </span>
        </Link>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <GroupedNav ariaLabel="Админы цэс" />
        </div>
        <UserBlock name={name} onLogout={onLogout} />
      </aside>

      {/* Утас: доод шилэн цэс ба "Бүх цэс" drawer */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="pt-ui fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm" />
          <Dialog.Content className="pt-ui fixed bottom-3 left-3 top-3 z-50 flex w-[280px] max-w-[85vw] flex-col rounded-[28px] bg-paper p-3 shadow-2xl">
            <Dialog.Title className="sr-only">Админы цэс</Dialog.Title>
            <Dialog.Description className="sr-only">Хэсгүүд рүү шилжих</Dialog.Description>
            <div className="flex items-center justify-between px-2 pb-4 pt-1.5">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 text-lg font-semibold text-white">π</span>
                <span className="pt-tight text-[17px] font-semibold">Пи тоо</span>
              </span>
              <Dialog.Close aria-label="Цэс хаах" className="grid size-11 place-items-center rounded-full bg-white">
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <GroupedNav ariaLabel="Админы цэс" onNavigate={() => setDrawer(false)} />
            </div>
            <UserBlock name={name} onLogout={onLogout} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <nav aria-label="Үндсэн цэс" className="pt-glass fixed inset-x-3 bottom-3 z-40 flex justify-between rounded-full p-1.5 lg:hidden">
        {BOTTOM.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={"end" in item ? item.end : undefined}
            aria-label={item.label}
            className={({ isActive }) =>
              cn("grid h-12 flex-1 place-items-center rounded-full", isActive ? "bg-brand-700 text-white" : "text-ink-500")
            }
          >
            <item.icon className="size-5" aria-hidden="true" />
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Бүх цэс"
          className="grid h-12 flex-1 place-items-center rounded-full text-ink-500"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={palette} studentsPath="/admin/students" />

      <main className="relative z-10 pb-28 lg:pb-12 lg:pl-[280px]">
        <div className="mx-auto max-w-[96rem] px-4 sm:px-8">
          <header className="flex items-center justify-between gap-3 pt-5 lg:pt-7">
            <Link to="/admin" className="flex min-h-11 items-center gap-2.5 lg:hidden" aria-label="Пи тоо, Самбар">
              <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 font-semibold text-white">π</span>
              <span className="pt-tight font-semibold">Пи тоо</span>
            </Link>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Сурагч хайх, Ctrl K"
              className="pt-glass hidden h-11 max-w-[440px] flex-1 items-center gap-3 rounded-full pl-4 pr-2 text-[14px] text-ink-500 transition-colors hover:text-ink-800 sm:flex"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="flex-1 text-left">Сурагч хайх…</span>
              <kbd className="inline-flex h-6 items-center rounded-md bg-paper-2 px-1.5 text-[10.5px] font-semibold text-ink-500">Ctrl K</kbd>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Хайх"
                className="pt-glass grid size-11 place-items-center rounded-full sm:hidden"
              >
                <Search className="size-[18px]" aria-hidden="true" />
              </button>
              <AdminBell />
              <button
                type="button"
                onClick={onLogout}
                className="pt-glass hidden h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-brand-700 transition-colors hover:bg-white sm:inline-flex"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Гарах
              </button>
            </div>
          </header>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
