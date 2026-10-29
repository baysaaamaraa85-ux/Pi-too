import {
  ATTENDANCE_STATUS_LABELS,
  type AttendanceRowDto,
  type AttendanceSheetDto,
  type AttendanceStatus,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/shared/api-client/client";
import { formatDate, formatTime } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { AttendanceStatusChip, StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

interface SaveResult {
  entries: {
    attendanceId: string;
    contractId: string;
    status: AttendanceStatus;
    remainingVisits: number;
    leavesLeft: number;
  }[];
}

interface MakeupCandidates {
  seatsFree: number;
  items: {
    contractId: string;
    studentName: string;
    programName: string;
    remainingVisits: number;
    leavesLeft: number;
    makeupsAvailable: number;
  }[];
}

const SHEET_KEY = "attendance-sheet";

function useSheet(lessonId: string) {
  return useQuery({
    queryKey: [SHEET_KEY, lessonId],
    queryFn: () => api.get<AttendanceSheetDto>(`/lessons/${lessonId}/attendance`),
  });
}

// Ирсэн / Ирээгүй сэлгүүр, хоёр товч нь 44 px-ээс багагүй (ФБШ-10).
function PresenceToggle({
  value,
  onChange,
  name,
}: {
  value: boolean;
  onChange: (present: boolean) => void;
  name: string;
}) {
  return (
    <div role="group" aria-label={`${name}: ирсэн эсэх`} className="inline-flex overflow-hidden rounded-xl border-[1.5px] border-border">
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(true)}
        className={cn(
          "min-h-11 min-w-20 px-3 text-sm font-bold transition-colors",
          value ? "bg-success text-white" : "bg-surface text-muted hover:bg-background-soft",
        )}
      >
        Ирсэн
      </button>
      <button
        type="button"
        aria-pressed={!value}
        onClick={() => onChange(false)}
        className={cn(
          "min-h-11 min-w-20 border-l border-border px-3 text-sm font-bold transition-colors",
          !value ? "bg-danger text-white" : "bg-surface text-muted hover:bg-background-soft",
        )}
      >
        Ирээгүй
      </button>
    </div>
  );
}

function RowInfo({ row }: { row: AttendanceRowDto }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-bold text-foreground-strong">{row.studentName}</p>
      <p className="truncate text-xs text-muted">{row.programName}</p>
      <p className="mt-0.5 text-sm text-mid">
        Багц <strong data-testid="row-balance">{row.remainingVisits}/{row.totalVisits}</strong> · Чөлөө{" "}
        <strong>{row.leavesLeft}</strong>
        {row.paymentStatus ? ` · ${row.paymentStatus}` : ""}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {row.leaveRequested ? <StatusChip tone="warning">Чөлөө хүссэн</StatusChip> : null}
        {row.isMakeup ? <StatusChip tone="info">Нөхөлт</StatusChip> : null}
      </div>
    </div>
  );
}

function EditModal({
  row,
  needsReason,
  onClose,
}: {
  row: AttendanceRowDto;
  needsReason: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [present, setPresent] = React.useState(row.present ?? true);
  const [reason, setReason] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const patch = useMutation({
    mutationFn: () =>
      api.patch(`/attendance/${row.attendanceId}`, { present, reason: reason.trim() || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [SHEET_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["ledger"] });
      onClose();
    },
  });
  return (
    <>
      <Modal open title={`Ирц засах: ${row.studentName}`} onClose={onClose}>
        <div className="grid gap-4">
          <PresenceToggle value={present} onChange={setPresent} name={row.studentName} />
          <p className="text-xs text-muted">
            Төлөв, багц, чөлөө, цалинг сервер дахин тооцно. Засвар зөвхөн энэ мөрөнд нөлөөлнө.
          </p>
          <Field label={needsReason ? "Шалтгаан (заавал)" : "Шалтгаан"} htmlFor="edit-reason">
            <Input id="edit-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FormError message={errorMessage(patch.error)} />
          <Button
            className="w-fit"
            disabled={patch.isPending || (needsReason && !reason.trim()) || present === row.present}
            onClick={() => setConfirm(true)}
          >
            Засах
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm}
        title="Ирц засах уу?"
        description="Багцын үлдэгдэл, чөлөөний эрх, багшийн цалин өөрчлөгдөж, эцэг эхэд шинэчилсэн мэдэгдэл очно."
        confirmLabel="Засах"
        busy={patch.isPending}
        onConfirm={() => patch.mutate()}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}

// ФШ-31: нөхөлт нэмэх.
function MakeupModal({
  lessonId,
  needsReason,
  onClose,
}: {
  lessonId: string;
  needsReason: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = React.useState("");
  const candidates = useQuery({
    queryKey: ["makeup-candidates", lessonId],
    queryFn: () => api.get<MakeupCandidates>(`/lessons/${lessonId}/makeup-candidates`),
  });
  const keyRef = React.useRef(crypto.randomUUID());
  const add = useMutation({
    mutationFn: (contractId: string) =>
      api.post(
        `/lessons/${lessonId}/makeups`,
        { contractId, reason: reason.trim() || undefined },
        keyRef.current,
      ),
    onSuccess: async () => {
      keyRef.current = crypto.randomUUID();
      await queryClient.invalidateQueries({ queryKey: [SHEET_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["makeup-candidates"] });
      onClose();
    },
  });
  return (
    <Modal
      open
      title="Нөхөлт нэмэх"
      description="Таны өөр ангийн, нөхөгдөөгүй чөлөөтэй сурагч. Нөхөлт багцаас хасагдаж, цалинд тооцогдоно."
      onClose={onClose}
    >
      {candidates.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {candidates.data ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted">Сул суудал: {candidates.data.seatsFree}</p>
          {candidates.data.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
              Нөхөх чөлөөтэй сурагч олдсонгүй.
            </p>
          ) : null}
          <ul className="grid gap-2">
            {candidates.data.items.map((c) => (
              <li
                key={c.contractId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-warm p-3"
              >
                <div className="min-w-0 text-sm">
                  <strong className="block truncate">{c.studentName}</strong>
                  <span className="text-muted">
                    Багц {c.remainingVisits} · нөхөх чөлөө {c.makeupsAvailable}
                  </span>
                </div>
                <Button
                  disabled={add.isPending || candidates.data.seatsFree <= 0 || (needsReason && !reason.trim())}
                  onClick={() => add.mutate(c.contractId)}
                >
                  Нэмэх
                </Button>
              </li>
            ))}
          </ul>
          {needsReason ? (
            <Field label="Шалтгаан (заавал)" htmlFor="makeup-reason">
              <Input id="makeup-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          ) : null}
          <FormError message={errorMessage(add.error)} />
        </div>
      ) : null}
    </Modal>
  );
}

// Ирцийн дэлгэц (ФШ-27, ФБШ-08): багш ба админ ижил дэлгэц ашиглана. Клиент зөвхөн
// "ирсэн эсэх" илгээнэ, төлөв, багц, чөлөө, цалинг сервер тооцно (ADR-007).
export function AttendancePage() {
  const { lessonId = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sheet = useSheet(lessonId);
  const [marks, setMarks] = React.useState<Record<string, boolean>>({});
  const [reason, setReason] = React.useState("");
  const [editing, setEditing] = React.useState<AttendanceRowDto | null>(null);
  const [makeupOpen, setMakeupOpen] = React.useState(false);
  const keyRef = React.useRef(crypto.randomUUID());
  const isAdmin = user?.role === "ADMIN";

  const save = useMutation({
    mutationFn: (entries: { contractId: string; present: boolean }[]) =>
      api.put<SaveResult>(
        `/lessons/${lessonId}/attendance`,
        { entries, reason: reason.trim() || undefined },
        keyRef.current,
      ),
    onSuccess: async () => {
      keyRef.current = crypto.randomUUID();
      setMarks({});
      await queryClient.invalidateQueries({ queryKey: [SHEET_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-day"] });
    },
  });

  if (sheet.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (!sheet.data) {
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        {errorMessage(sheet.error) ?? "Ирцийн дэлгэцийг ачаалж чадсангүй."}
      </p>
    );
  }
  const data = sheet.data;
  const cancelled = data.lesson.status === "CANCELLED";
  const outsideWindow = !data.windowOpen;
  const needsReason = isAdmin && outsideWindow;
  const canWrite = !cancelled && data.started && (data.windowOpen || isAdmin);

  // ФШ-27: анхдагч "Ирсэн"; ФШ-30: чөлөө хүссэн сурагч урьдчилан "Ирээгүй".
  const effective = (row: AttendanceRowDto) => marks[row.contractId] ?? !row.leaveRequested;
  const unsaved = data.rows.filter((r) => r.attendanceId === null);
  const backTo = isAdmin ? "/admin/attendance" : "/teacher";

  return (
    <>
      <PageHeader
        title="Ирц бүртгэх"
        subtitle={`${data.lesson.branchName} · ${formatDate(data.lesson.startsAt)} ${formatTime(data.lesson.startsAt)}-${formatTime(data.lesson.endsAt)} · ${data.lesson.teacherName}`}
        action={
          <Link to={backTo} className="text-sm font-semibold text-primary hover:underline">
            Буцах
          </Link>
        }
      />

      {cancelled ? (
        <p className="mb-4 rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
          Хичээл цуцлагдсан тул ирц бүртгэгдэхгүй.
        </p>
      ) : !data.started ? (
        <p className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning">
          Хичээл эхлээгүй байна. Эхэлснээс хойш ирц бүртгэнэ.
        </p>
      ) : outsideWindow ? (
        <p className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning" data-testid="window-closed">
          {isAdmin
            ? "Засах хугацаа (24 цаг) дууссан. Админ шалтгаан бичиж бүртгэнэ."
            : "Засах хугацаа (24 цаг) дууссан. Зөвхөн админ засна, админд хандана уу."}
        </p>
      ) : null}

      <ul className="grid gap-3 pb-32" data-testid="attendance-rows">
        {data.rows.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
            Энэ хичээлд бүртгэлтэй сурагч алга.
          </li>
        ) : null}
        {data.rows.map((row) => (
          <li key={row.contractId}>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="attendance-row">
              <RowInfo row={row} />
              {row.attendanceId ? (
                <div className="flex items-center gap-2">
                  <span data-testid="row-status">
                    <AttendanceStatusChip
                      status={row.status ?? ""}
                      label={ATTENDANCE_STATUS_LABELS[row.status as AttendanceStatus] ?? ""}
                    />
                  </span>
                  {canWrite ? (
                    <Button variant="secondary" onClick={() => setEditing(row)}>
                      Засах
                    </Button>
                  ) : null}
                </div>
              ) : (
                <PresenceToggle
                  name={row.studentName}
                  value={effective(row)}
                  onChange={(present) => setMarks((prev) => ({ ...prev, [row.contractId]: present }))}
                />
              )}
            </Card>
          </li>
        ))}
      </ul>

      {canWrite ? (
        <div
          className={cn(
            "fixed inset-x-0 z-30 border-t border-border-warm bg-white/95 p-3 backdrop-blur-md",
            isAdmin ? "bottom-0 md:left-64" : "bottom-14 md:bottom-0",
          )}
        >
          <div className="mx-auto flex max-w-270 flex-wrap items-center gap-2">
            {needsReason ? (
              <Input
                aria-label="Шалтгаан"
                placeholder="Шалтгаан (заавал)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-w-0 flex-1"
              />
            ) : null}
            <FormError message={errorMessage(save.error)} />
            <Button variant="secondary" onClick={() => setMakeupOpen(true)}>
              Нөхөлт нэмэх
            </Button>
            <Button
              className="flex-1 sm:flex-none sm:min-w-40"
              disabled={unsaved.length === 0 || save.isPending || (needsReason && !reason.trim())}
              onClick={() =>
                save.mutate(unsaved.map((r) => ({ contractId: r.contractId, present: effective(r) })))
              }
            >
              Хадгалах
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <EditModal row={editing} needsReason={needsReason} onClose={() => setEditing(null)} />
      ) : null}
      {makeupOpen ? (
        <MakeupModal lessonId={lessonId} needsReason={needsReason} onClose={() => setMakeupOpen(false)} />
      ) : null}
    </>
  );
}
