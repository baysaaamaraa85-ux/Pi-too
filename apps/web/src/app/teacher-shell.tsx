import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, ClipboardList, KeyRound, LayoutGrid, LogOut, Menu, School, Search, UserRound, Users, Wallet, X } from "lucide-react";
import * as React from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { useTeacherDashboard } from "@/features/dashboard/dashboard-api";
import { TEACHER_ACTIONS } from "@/features/dashboard/teacher-actions";
import { useOwnTeacherProfile } from "@/features/public/public-api";
import { useMyPlacementRequests } from "@/features/teacher/placement-api";
import { formatDate, formatTime } from "@/shared/format/date";
import { OfflineBanner } from "@/shared/offline/sync";
import "@/shared/pt/pt.css";
import { Avatar } from "@/shared/ui/avatar";
import { PillBottomNav, PillNav, type PillItem } from "@/shared/ui/pill-nav";
import { cn } from "@/shared/ui/utils";
import { ReminderBell, type BellItem } from "./app-topbar";
import { CommandPalette, type PaletteItem } from "./command-palette";

// Багшийн самбарын бүрхүүл (D-87, teacher_today_v5.html): хажуугийн цэсийн оронд дээд талд хөвөх шилэн шахмал цэс,
// хайлт (Ctrl K), хонх, профайл. Утсанд доод шилэн цэс. Эцэг эх, сурагчийн бүрхүүл (AppShell) өөрчлөгдөөгүй.

const PAGES = [
  { key: "today", to: "/teacher", label: "Өнөөдөр", icon: LayoutGrid },
  { key: "calendar", to: "/teacher/calendar", label: "Хуваарь", icon: CalendarDays },
  { key: "classes", to: "/teacher/classes", label: "Анги", icon: School },
  { key: "students", to: "/teacher/students", label: "Сурагчид", icon: Users },
  { key: "salary", to: "/teacher/salary", label: "Цалин", icon: Wallet },
] as const;

// Одоогийн хуудас цэсний аль зүйлд хамаарах вэ (идэвхтэй заагч). Профайл аль нь ч биш.
function activeKey(pathname: string): string | null {
  if (pathname === "/teacher" || pathname.startsWith("/teacher/attendance")) return "today";
  if (pathname.startsWith("/teacher/calendar")) return "calendar";
  if (pathname.startsWith("/teacher/classes")) return "classes";
  if (pathname.startsWith("/teacher/students") || pathname.startsWith("/teacher/enroll")) return "students";
  if (pathname.startsWith("/teacher/salary")) return "salary";
  return null;
}

const iconButton =
  "pt-glass grid size-11 shrink-0 place-items-center rounded-full text-ink-600 transition-colors hover:bg-white hover:text-ink-900 motion-reduce:transition-none";

export function TeacherShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const dash = useTeacherDashboard().data;
  const profile = useOwnTeacherProfile(user?.id);
  // D-102: салбарын ахлагч (эсвэл хүсэлт шилжүүлж авсан) багшид "Түвшин тогтоох хүсэлт" холбоос харагдана.
  const placement = useMyPlacementRequests().data;
  const hasPlacement = !!placement && (placement.isLead || placement.requests.length > 0);
  const newPlacement = placement?.requests.filter((r) => r.status === "NEW").length ?? 0;
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);

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

  const unfilled = dash?.unfilledLessons.length ?? 0;
  // Цэсний тоон тэмдэг: "Өнөөдөр" дээр ирц бөглөөгүй хичээл (анхаарах), "Сурагчид" дээр идэвхтэй сурагчийн тоо.
  const items: PillItem[] = PAGES.map((p) => {
    if (p.key === "today" && unfilled > 0) return { ...p, badge: { count: unfilled, alert: true } };
    if (p.key === "students" && dash) return { ...p, badge: { count: dash.stats.students } };
    return { ...p };
  });

  const palette: PaletteItem[] = [
    ...PAGES.map((p) => ({ group: "Хуудас", label: p.label, icon: p.icon, to: p.to })),
    { group: "Хуудас", label: "Миний профайл", icon: UserRound, to: "/teacher/profile" },
    ...(hasPlacement ? [{ group: "Хуудас", label: "Түвшин тогтоох хүсэлт", icon: ClipboardList, to: "/teacher/placement-requests" }] : []),
    ...TEACHER_ACTIONS.map((a) => ({ group: "Үйлдэл", label: a.title, icon: a.icon, to: a.to })),
  ];

  // Сануулгын хонх: ирц бөглөөгүй хичээл, цагийн үнэлгээгүй сурагч (D-67), уулзалт, багцын шалгалт.
  const bell: BellItem[] = [
    ...(newPlacement > 0
      ? [
          {
            key: "placement",
            to: "/teacher/placement-requests",
            title: `Шинэ түвшин тогтоох хүсэлт: ${newPlacement}`,
            detail: "Эцэг эхтэй холбогдоно уу",
          },
        ]
      : []),
    ...(dash?.unfilledLessons ?? []).map((l) => ({
      key: `lesson-${l.id}`,
      to: `/teacher/attendance/${l.id}`,
      title: "Ирц бөглөөгүй хичээл",
      detail: `${formatDate(l.startsAt)} ${formatTime(l.startsAt)} · ${l.branchName}`,
    })),
    ...(dash?.unratedStudents ?? []).map((u) => ({
      key: `rate-${u.contractId}`,
      to: `/teacher/students/${u.studentId}`,
      title: "Цагийн үнэлгээ оруулаагүй",
      detail: `${u.studentName} · ${u.programName}`,
    })),
    ...(dash?.tasks ?? []).map((t) => ({
      key: `task-${t.id}`,
      to: `/teacher/students/${t.studentId}`,
      title: t.type === "MEETING" ? "Эцэг эхтэй уулзах" : "Багцын шалгалт",
      detail: t.studentName,
    })),
  ];

  if (!user) return null;
  const active = activeKey(pathname);
  const isDrawerActive = (key: string) =>
    key === "profile"
      ? pathname.startsWith("/teacher/profile")
      : key === "placement"
        ? pathname.startsWith("/teacher/placement-requests")
        : active === key;
  const name = user.displayName ?? "";

  return (
    <div className="pt-ui relative min-h-screen overflow-x-clip bg-paper text-ink-900">
      <header className="fixed inset-x-0 top-0 z-40">
        {/* Гүйлгэхэд лого, товчийн ард контент давхцахаас сэргийлэх зөөлөн бүдгэрүүлэлт (дэвсгэр өнгөтэй ижил) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-paper from-40% to-transparent" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-[1280px] items-center justify-between gap-1.5 px-3 pt-4 sm:gap-3 sm:px-6">
          <Link to="/teacher" className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label="Пи тоо, Өнөөдөр">
            <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 text-lg font-semibold text-white shadow-[0_8px_20px_-8px_rgba(139,26,26,0.7)]">
              π
            </span>
            <span className="pt-tight hidden text-[17px] font-semibold sm:block">Пи тоо</span>
          </Link>

          <PillNav items={items} activeKey={active} ariaLabel="Багшийн цэс" />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Хайх, Ctrl K"
              className="pt-glass inline-flex h-11 min-w-11 items-center justify-center gap-2.5 rounded-full text-[13px] text-ink-500 transition-colors hover:text-ink-900 sm:pl-3.5 sm:pr-2"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Хайх</span>
              <kbd className="hidden h-6 items-center rounded-md bg-paper-2 px-1.5 text-[10.5px] font-semibold text-ink-500 sm:inline-flex">Ctrl K</kbd>
            </button>
            <ReminderBell items={bell} glass />
            {/* Утсанд (lg-ээс доош) нууц үг, гарах нь "Цэс" drawer-ын доод хэсэгт байна */}
            <Link to="/change-password" aria-label="Нууц үг" className={cn(iconButton, "max-lg:hidden")}>
              <KeyRound className="size-[17px]" aria-hidden="true" />
            </Link>
            <button type="button" onClick={() => void logout()} aria-label="Гарах" className={cn(iconButton, "max-lg:hidden")}>
              <LogOut className="size-[17px]" aria-hidden="true" />
            </button>
            <Link
              to="/teacher/profile"
              aria-label="Миний профайл"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-700 pl-1.5 pr-1.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-800 sm:pr-3.5"
            >
              <Avatar
                url={profile?.photoUrl ?? null}
                name={name}
                className="size-8 bg-gradient-to-br from-gold-300 via-brand-400 to-brand-800 text-[12px] font-semibold"
              />
              <span className="hidden sm:inline" data-testid="sidebar-name">
                {name}
              </span>
            </Link>
          </div>
        </div>
      </header>

      <PillBottomNav
        items={items}
        activeKey={active}
        ariaLabel="Үндсэн цэс"
        extra={
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Бүх цэс"
            className="grid h-12 flex-1 place-items-center rounded-full text-ink-500"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        }
      />

      {/* Утас: "Бүх цэс" drawer. Хуудсууд, профайл, хамгийн доор нууц үг солих ба гарах */}
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="pt-ui fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm" />
          <Dialog.Content className="pt-ui fixed bottom-3 right-3 top-3 z-50 flex w-[280px] max-w-[85vw] flex-col rounded-[28px] bg-paper p-3 shadow-2xl">
            <Dialog.Title className="sr-only">Багшийн цэс</Dialog.Title>
            <Dialog.Description className="sr-only">Хэсгүүд рүү шилжих, нууц үг солих, гарах</Dialog.Description>
            <div className="flex items-center justify-between px-2 pb-4 pt-1.5">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-[13px] bg-brand-700 text-lg font-semibold text-white">π</span>
                <span className="pt-tight text-[17px] font-semibold">Пи тоо</span>
              </span>
              <Dialog.Close aria-label="Цэс хаах" className="grid size-11 place-items-center rounded-full bg-white">
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <nav aria-label="Багшийн бүх цэс" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
              {[
                ...PAGES,
                ...(hasPlacement ? [{ key: "placement", to: "/teacher/placement-requests", label: "Түвшин тогтоох хүсэлт", icon: ClipboardList }] : []),
                { key: "profile", to: "/teacher/profile", label: "Миний профайл", icon: UserRound },
              ].map((p) => (
                <Link
                  key={p.key}
                  to={p.to}
                  onClick={() => setDrawer(false)}
                  aria-current={isDrawerActive(p.key) ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-3 rounded-[14px] px-3 text-[14px] font-medium transition-colors motion-reduce:transition-none",
                    isDrawerActive(p.key)
                      ? "bg-brand-700 text-white shadow-[0_10px_22px_-10px_rgba(139,26,26,0.7)]"
                      : "text-ink-600 hover:bg-white/80 hover:text-ink-900",
                  )}
                >
                  <p.icon className="size-[18px] shrink-0" aria-hidden="true" />
                  {p.label}
                </Link>
              ))}
              <div className="mt-auto flex flex-col gap-0.5 border-t border-paper-3 pt-2">
                <Link
                  to="/change-password"
                  onClick={() => setDrawer(false)}
                  className="flex h-11 shrink-0 items-center gap-3 rounded-[14px] px-3 text-[14px] font-medium text-ink-600 transition-colors hover:bg-white/80 hover:text-ink-900 motion-reduce:transition-none"
                >
                  <KeyRound className="size-[18px] shrink-0" aria-hidden="true" />
                  Нууц үг солих
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex h-11 shrink-0 items-center gap-3 rounded-[14px] px-3 text-left text-[14px] font-medium text-brand-700 transition-colors hover:bg-white/80 motion-reduce:transition-none"
                >
                  <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
                  Гарах
                </button>
              </div>
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={palette} studentsPath="/teacher/students" />

      <div className="pt-24 [&>div]:top-24">
        <OfflineBanner />
      </div>
      <main className="mx-auto max-w-[96rem] px-4 pb-28 pt-2 sm:px-7 lg:pb-16">
        <Outlet />
      </main>
    </div>
  );
}
