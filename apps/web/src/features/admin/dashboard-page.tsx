import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileBarChart,
  Bell,
  FileText,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { useAdminDashboard } from "@/features/dashboard/dashboard-api";
import { api } from "@/shared/api-client/client";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { formatDate, weekdayName, weekdayOf } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { DashHeader, Panel, PanelTitle, StatCard } from "@/shared/ui/dash";

const SETUP: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/catalog", label: "Салбар, хөтөлбөр, журам", icon: Settings },
  { to: "/admin/teachers", label: "Багш, сурагч, эцэг эх", icon: Users },
  { to: "/admin/enroll", label: "Шинэ сурагч бүртгэх", icon: UserPlus },
  { to: "/admin/setup", label: "Анхны тохиргооны алхмууд", icon: Sparkles },
];

const ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/admin/enroll", label: "Сурагч бүртгэх", icon: UserPlus },
  { to: "/admin/teachers", label: "Багш нэмэх", icon: Users },
  { to: "/admin/attendance", label: "Ирц харах", icon: CalendarDays },
  { to: "/admin/payments", label: "Төлбөр бүртгэх", icon: Wallet },
  { to: "/admin/notifications", label: "Мэдэгдэл харах", icon: Bell },
  { to: "/admin/reports", label: "Тайлан гаргах", icon: FileBarChart },
];

// Захирлын самбар: "үйлдэлд хөтлөх" гурван карт (ФШ-68: өртэй гэрээ, сөрөг үлдэгдэлтэй багш, шинэ хүсэлт),
// дарахад шүүлттэй жагсаалт нээгдэнэ. Доор тохиргооны сонголт ба шуурхай үйлдэл.
export function AdminDashboardPage() {
  const dash = useAdminDashboard();
  const requests = useQuery({
    queryKey: ["placement-requests", "NEW"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests?status=NEW"),
  });
  const d = dash.data;
  const now = new Date();

  return (
    <>
      <DashHeader
        title="Захирлын самбар"
        subtitle="Өнөөдрийн ажил нь амжилт хүсье!"
        aside={
          <span className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border-warm bg-white/80 px-4 text-sm font-semibold text-mid shadow-soft">
            <CalendarDays className="size-4 text-primary" />
            {formatDate(now)}, {weekdayName(weekdayOf(now))}
          </span>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          testId="kpi-debts"
          valueTestId="kpi-debts-count"
          to="/admin/payments?tab=debts"
          icon={FileText}
          tone="danger"
          label="Үлдэгдэлтэй гэрээ"
          value={d?.debts.count ?? "..."}
          hint={d ? formatMoney(d.debts.totalDebt) : undefined}
          hintTone="danger"
        />
        <StatCard
          testId="kpi-negative-teachers"
          valueTestId="kpi-negative-teachers-count"
          to="/admin/payroll?negative=1"
          icon={Wallet}
          tone="warning"
          label="Сөрөг үлдэгдэлтэй багш"
          value={d?.negativeTeachers.count ?? "..."}
          hint={d ? formatMoney(d.negativeTeachers.totalNegative) : undefined}
        />
        <StatCard
          testId="kpi-requests"
          valueTestId="kpi-requests-count"
          to="/admin/requests"
          icon={ClipboardList}
          label="Түвшин тогтоох хүсэлт"
          value={requests.data?.length ?? "..."}
          hint="шинэ хүсэлт"
        />
      </div>

      <section
        className="mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-4 text-primary-foreground shadow-lg sm:p-5"
        aria-labelledby="setup-title"
      >
        <h2 id="setup-title" className="mb-3 font-display text-xl font-bold">
          Тохиргооны сонголтууд
        </h2>
        <ul className="grid gap-2">
          {SETUP.map((s) => (
            <li key={s.to + s.label}>
              <Link
                to={s.to}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold transition-colors hover:bg-white/20"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-primary">
                  <s.icon className="size-[18px]" />
                </span>
                <span className="flex-1">{s.label}</span>
                <ChevronRight className="size-4 text-white/80" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Panel aria-labelledby="actions-title">
        <PanelTitle icon={Sparkles}>
          <span id="actions-title">Шуурхай үйлдлүүд</span>
        </PanelTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {ACTIONS.map((a) => (
            <li key={a.label}>
              <Link
                to={a.to}
                className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl p-2 text-center text-[0.78rem] font-semibold text-mid transition-colors hover:bg-primary/6 hover:text-primary"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/8 text-primary">
                  <a.icon className="size-5" />
                </span>
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
