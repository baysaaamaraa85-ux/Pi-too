import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Settings, UserPlus, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { formatTime } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Card } from "@/shared/ui/card";
import { StatusChip } from "@/shared/ui/status-chip";
import { useAdminDashboard } from "@/features/dashboard/dashboard-api";

function QuickLink({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border-warm bg-surface p-5 shadow-md transition duration-300 hover:-translate-y-0.75 hover:border-primary/25"
    >
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-primary/9 text-primary">
        <Icon className="size-5" />
      </span>
      <h2 className="font-display text-base font-bold text-foreground-strong">{title}</h2>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-muted">{text}</p>
    </Link>
  );
}

// ФШ-68: "үйлдэлд хөтлөх" хоёр карт (өртэй гэрээ, сөрөг үлдэгдэлтэй багш), дарахад шүүлттэй
// жагсаалт нээгдэнэ. Доор нь өнөөдрийн хичээлүүд.
function KpiCard({
  to,
  label,
  count,
  amount,
  tone,
  testId,
}: {
  to: string;
  label: string;
  count: number | undefined;
  amount: string | undefined;
  tone: "danger" | "warning";
  testId: string;
}) {
  return (
    <Link to={to} className="block" data-testid={testId}>
      <Card className="h-full p-5 transition hover:border-primary/25 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
        <p
          className={`mt-1 font-display text-4xl font-black ${tone === "danger" ? "text-danger" : "text-warning"}`}
          data-testid={`${testId}-count`}
        >
          {count === undefined ? "..." : count}
        </p>
        <p className="text-sm text-muted">
          {amount === undefined ? "" : formatMoney(amount)}
        </p>
      </Card>
    </Link>
  );
}

export function AdminDashboardPage() {
  const dash = useAdminDashboard();
  const newRequests = useQuery({
    queryKey: ["placement-requests", "NEW"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests?status=NEW"),
  });
  const count = newRequests.data?.length;
  const d = dash.data;

  return (
    <>
      <PageHeader title="Админы самбар" subtitle="Өнөөдрийн хийх ажлууд" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <KpiCard
          testId="kpi-debts"
          to="/admin/payments?tab=debts"
          label="Үлдэгдэлтэй гэрээ"
          count={d?.debts.count}
          amount={d?.debts.totalDebt}
          tone="danger"
        />
        <KpiCard
          testId="kpi-negative-teachers"
          to="/admin/payroll?negative=1"
          label="Сөрөг үлдэгдэлтэй багш"
          count={d?.negativeTeachers.count}
          amount={d?.negativeTeachers.totalNegative}
          tone="warning"
        />
      </div>

      <section className="mb-8" aria-labelledby="today-lessons-title">
        <h2 id="today-lessons-title" className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
          Өнөөдрийн хичээл
        </h2>
        {d && d.todayLessons.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted">
            Өнөөдөр хичээл алга.
          </p>
        ) : null}
        <div className="grid gap-2" data-testid="today-lessons">
          {d?.todayLessons.map((lesson) => (
            <Link key={lesson.id} to={`/admin/attendance/${lesson.id}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 hover:border-primary/25">
                <div>
                  <p className="font-semibold text-foreground-strong">
                    {formatTime(lesson.startsAt)} · {lesson.branchName}
                  </p>
                  <p className="text-[0.82rem] text-muted">{lesson.teacherName}</p>
                </div>
                {lesson.status === "CANCELLED" ? (
                  <StatusChip tone="neutral">Цуцлагдсан</StatusChip>
                ) : lesson.expected > 0 && lesson.recorded >= lesson.expected ? (
                  <StatusChip tone="success">Ирц бөглөсөн</StatusChip>
                ) : (
                  <StatusChip tone="warning">
                    Ирц {lesson.recorded}/{lesson.expected}
                  </StatusChip>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Link to="/admin/setup" className="mb-4 block text-sm font-semibold text-primary hover:underline">
        Анхны тохиргооны алхмууд
      </Link>

      <Link to="/admin/requests" className="mb-6 block">
        <Card className="flex items-center justify-between gap-4 p-5 transition hover:border-primary/25 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Түвшин тогтоох цагийн хүсэлт
            </p>
            <p className="mt-1 font-display text-4xl font-black text-primary">
              {count === undefined ? "..." : count}
            </p>
            <p className="text-sm text-muted">Холбогдох шаардлагатай шинэ хүсэлт</p>
          </div>
          <ClipboardList className="size-10 text-primary/30" />
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          to="/admin/enroll"
          icon={UserPlus}
          title="Шинэ сурагч бүртгэх"
          text="Эцэг эх, сурагч, багц, ангийг нэг дор бүртгэнэ."
        />
        <QuickLink
          to="/admin/teachers"
          icon={Users}
          title="Багш, сурагч, эцэг эх"
          text="Хэрэглэгчийн данс үүсгэх, түр нууц үг."
        />
        <QuickLink
          to="/admin/catalog"
          icon={Settings}
          title="Салбар, хөтөлбөр, журам"
          text="Салбар, багцын үнэ, журмын утгууд."
        />
      </div>
    </>
  );
}
