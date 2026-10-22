import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Settings, UserPlus, Users, type LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { Card } from "@/shared/ui/card";

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

// ФШ-67 (эхний хувилбар): админы нүүр, үйлдэлд хөтлөх картууд.
export function AdminDashboardPage() {
  const newRequests = useQuery({
    queryKey: ["placement-requests", "NEW"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests?status=NEW"),
  });
  const count = newRequests.data?.length;

  return (
    <>
      <PageHeader title="Админы самбар" subtitle="Өнөөдрийн хийх ажлууд" />

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
          to="/admin/users"
          icon={Users}
          title="Хэрэглэгч үүсгэх"
          text="Багш, эцэг эхийн нэвтрэх данс, түр нууц үг."
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
