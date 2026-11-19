import { PLACEMENT_REQUEST_STATUS_LABELS, type PlacementRequestStatus } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { ApiError, api } from "@/shared/api-client/client";
import type { PlacementRequestDto } from "@/shared/api-client/types";
import { formatDateTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { StatusChip, type ChipTone } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

export const STATUSES = Object.keys(PLACEMENT_REQUEST_STATUS_LABELS) as PlacementRequestStatus[];
const TONE: Record<PlacementRequestStatus, ChipTone> = {
  NEW: "warning",
  CONTACTED: "info",
  SCHEDULED: "info",
  DONE: "success",
  CANCELLED: "neutral",
};

// D-102: админ ба багшийн (салбарын ахлагч, хүсэлт шилжүүлж авсан багш) хуудас хоёуланд ижил карт. extra нь картын доод
// хэсэгт нэмэлт үйлдэл (жишээ нь шилжүүлэх) тавихад.
export function RequestCard({ request, extra }: { request: PlacementRequestDto; extra?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<PlacementRequestStatus>(request.status);
  const [note, setNote] = React.useState(request.note ?? "");

  const save = useMutation({
    mutationFn: () => api.patch(`/placement-requests/${request.id}`, { status, note: note || undefined }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["placement-requests"] }),
  });
  const dirty = status !== request.status || note !== (request.note ?? "");

  return (
    <Card className="p-5" data-testid="placement-request">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground-strong">
            {request.studentName}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            <a href={`tel:+976${request.phone}`} className="font-semibold text-primary">
              {request.phone}
            </a>
            {request.grade ? ` · ${request.grade}` : ""}
            {request.school ? ` · ${request.school}` : ""}
          </p>
        </div>
        <StatusChip tone={TONE[request.status]}>
          {PLACEMENT_REQUEST_STATUS_LABELS[request.status]}
        </StatusChip>
      </div>
      <p className="mt-2 text-[0.82rem] text-muted">
        {request.branch?.name ?? "Салбар сонгоогүй"}
        {request.programInterest ? ` · ${request.programInterest}` : ""} ·{" "}
        {formatDateTime(request.createdAt)}
      </p>
      <p className="mt-1 text-[0.82rem] text-muted" data-testid="placement-assignee">
        {request.assignedTeacher ? `Хариуцсан багш: ${request.assignedTeacher.fullName}` : "Хариуцсан багш томилогдоогүй"}
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-[180px_1fr_auto]">
        <Select
          aria-label="Төлөв"
          value={status}
          onChange={(e) => setStatus(e.target.value as PlacementRequestStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {PLACEMENT_REQUEST_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Тэмдэглэл"
          placeholder="Тэмдэглэл (жишээ: Баасан 17:00)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button size="default" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          Хадгалах
        </Button>
      </div>
      {save.error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {save.error instanceof ApiError ? save.error.problem.detail : "Хадгалахад алдаа гарлаа."}
        </p>
      ) : null}
      {extra}
    </Card>
  );
}

// Төлвөөр шүүх товчнууд (админ ба багшийн хуудас хоёуланд).
export function RequestStatusFilter({
  value,
  onChange,
}: {
  value: PlacementRequestStatus | "ALL";
  onChange: (next: PlacementRequestStatus | "ALL") => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {(["ALL", ...STATUSES] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "rounded-full border-[1.5px] border-border bg-surface px-4 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary",
            value === s && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {s === "ALL" ? "Бүгд" : PLACEMENT_REQUEST_STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

// Нийтийн сайтаас ирсэн хүсэлтүүд: салбарын ахлагч холбогдож цаг товлоно, админ бүгдийг харна.
export function AdminRequestsPage() {
  const [filter, setFilter] = React.useState<PlacementRequestStatus | "ALL">("NEW");
  const requests = useQuery({
    queryKey: ["placement-requests"],
    queryFn: () => api.get<PlacementRequestDto[]>("/placement-requests"),
  });
  const shown = (requests.data ?? []).filter((r) => filter === "ALL" || r.status === filter);

  return (
    <>
      <PageHeader title="Хүсэлтүүд" subtitle="Түвшин тогтоох цаг захиалсан эцэг эхүүд" />
      <RequestStatusFilter value={filter} onChange={setFilter} />
      {requests.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      <div className="grid gap-4">
        {shown.map((r) => (
          <RequestCard key={`${r.id}-${r.status}-${r.note}`} request={r} />
        ))}
        {requests.data && shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
            Хүсэлт алга байна.
          </p>
        ) : null}
      </div>
    </>
  );
}
