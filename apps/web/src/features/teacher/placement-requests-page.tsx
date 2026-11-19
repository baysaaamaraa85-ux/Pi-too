import type {
  PlacementForwardCandidateDto,
  PlacementRequestDto,
  PlacementRequestStatus,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { RequestCard, RequestStatusFilter } from "@/features/admin/requests-page";
import { errorMessage } from "@/features/admin/list-kit";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Modal } from "@/shared/ui/modal";
import { useMyPlacementRequests } from "./placement-api";

// D-102: ахлагч хүсэлтийг салбарын өөр багшид шилжүүлнэ (тэр багш мэдэгдэл авч, хүсэлтийг өөрийн хуудаснаас харна).
function ForwardModal({ request, onClose }: { request: PlacementRequestDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = React.useState("");
  const candidates = useQuery({
    queryKey: ["placement-requests", "candidates", request.id],
    queryFn: () => api.get<PlacementForwardCandidateDto[]>(`/placement-requests/${request.id}/forward-candidates`),
  });
  const forward = useMutation({
    mutationFn: () => api.post(`/placement-requests/${request.id}/forward`, { teacherId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["placement-requests"] });
      onClose();
    },
  });
  const list = candidates.data ?? [];

  return (
    <Modal
      open
      title="Хүсэлтийг шилжүүлэх"
      description={`${request.studentName}: салбар дээрээ байхгүй бол салбарын өөр багшид шилжүүлнэ. Тэр багш мэдэгдэл авч, эцэг эхтэй холбогдоно.`}
      onClose={onClose}
    >
      {candidates.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {candidates.data && list.length === 0 ? (
        <p className="text-sm text-muted" data-testid="forward-empty">
          Шилжүүлэх боломжтой өөр багш алга. Салбарт идэвхтэй анги заадаг өөр багш байх ёстой.
        </p>
      ) : null}
      {list.length > 0 ? (
        <Field label="Шилжүүлэх багш" htmlFor="forward-teacher">
          <Select id="forward-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Багш сонгох</option>
            {list.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <FormError message={errorMessage(forward.error)} />
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={forward.isPending}>
          Болих
        </Button>
        <Button
          type="button"
          data-testid="forward-confirm"
          disabled={!teacherId || forward.isPending}
          onClick={() => forward.mutate()}
        >
          {forward.isPending ? "Шилжүүлж байна..." : "Шилжүүлэх"}
        </Button>
      </div>
    </Modal>
  );
}

const OPEN: PlacementRequestStatus[] = ["NEW", "CONTACTED", "SCHEDULED"];

// D-102: салбарын ахлагч (эсвэл хүсэлт шилжүүлж авсан багш) түвшин тогтоох хүсэлтийг харж, эцэг эхтэй холбогдож төлөв,
// тэмдэглэл бичнэ. Ахлагч салбар дээрээ байхгүй бол салбарын өөр багшид шилжүүлнэ.
export function TeacherPlacementRequestsPage() {
  const { user } = useAuth();
  const mine = useMyPlacementRequests();
  const [filter, setFilter] = React.useState<PlacementRequestStatus | "ALL">("NEW");
  const [forwarding, setForwarding] = React.useState<PlacementRequestDto | null>(null);

  const data = mine.data;
  const ledIds = new Set((data?.ledBranches ?? []).map((b) => b.id));
  const shown = (data?.requests ?? []).filter((r) => filter === "ALL" || r.status === filter);

  return (
    <>
      <PageHeader
        title="Түвшин тогтоох хүсэлт"
        subtitle={
          data?.isLead
            ? `Таны ахалдаг салбар: ${data.ledBranches.map((b) => b.name).join(", ")}`
            : "Танд шилжүүлсэн хүсэлтүүд"
        }
      />
      {data?.isLead ? (
        <p className="mb-5 max-w-3xl text-sm text-muted" data-testid="lead-note">
          Таны салбарт түвшин тогтоох цаг захиалсан эцэг эхийн хүсэлт энд ирнэ. Эцэг эхтэй шууд холбогдож, төлөв ба
          тэмдэглэлээ бичнэ үү. Салбар дээрээ байхгүй бол салбарын өөр багшид шилжүүлж болно.
        </p>
      ) : null}

      <RequestStatusFilter value={filter} onChange={setFilter} />
      {mine.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {mine.isError ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          Хүсэлтүүдийг ачаалж чадсангүй.
        </p>
      ) : null}
      <div className="grid gap-4">
        {shown.map((r) => {
          const canForward = !!r.branch && ledIds.has(r.branch.id) && OPEN.includes(r.status);
          const assignedToMe = r.assignedTeacher?.id === user?.id && !(r.branch && ledIds.has(r.branch.id));
          return (
            <div key={`${r.id}-${r.status}-${r.note}-${r.assignedTeacher?.id}`}>
              {assignedToMe ? (
                <p className="mb-1.5 text-xs font-semibold text-primary" data-testid="forwarded-to-me">
                  Танд шилжүүлсэн хүсэлт
                </p>
              ) : null}
              <RequestCard
                request={r}
                extra={
                  canForward ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        data-testid="forward-open"
                        onClick={() => setForwarding(r)}
                      >
                        Салбарын өөр багшид шилжүүлэх
                      </Button>
                    </div>
                  ) : null
                }
              />
            </div>
          );
        })}
        {data && shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
            Хүсэлт алга байна.
          </p>
        ) : null}
      </div>
      {forwarding ? <ForwardModal request={forwarding} onClose={() => setForwarding(null)} /> : null}
    </>
  );
}
