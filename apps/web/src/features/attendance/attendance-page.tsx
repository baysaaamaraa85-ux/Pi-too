import {
  ATTENDANCE_STATUS_LABELS,
  TEACHER_PAYMENT_FLAG_LABELS,
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
import { api, isNetworkError } from "@/shared/api-client/client";
import { enqueueAttendance } from "@/shared/offline/attendance-queue";
import { useQueue } from "@/shared/offline/sync";
import { formatDate, formatTime } from "@/shared/format/date";
import { academicHoursOf, formatHours, toMinutes } from "@/shared/format/hours";
import { TimeSelect24 } from "@/shared/ui/time-select";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { NoteModal } from "@/features/progress/progress-parts";
import { AttendanceStatusChip, StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

interface SaveResult {
  // ФБШ-15: сүлжээгүй үед ирц төхөөрөмжид хадгалагдсан (холбогдмогц илгээгдэнэ).
  queued?: true;
  entries: {
    attendanceId: string;
    contractId: string;
    status: AttendanceStatus;
    remainingHours: number;
    packageHours: number;
    leavesLeft: number;
  }[];
}

// D-70: бодит цаг ("HH:MM"). Хоосон бол хичээлийн төлөвлөсөн цаг.
interface ActualTime {
  from: string;
  to: string;
}

interface MakeupCandidates {
  seatsFree: number;
  items: {
    contractId: string;
    studentName: string;
    programName: string;
    remainingHours: number;
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
        Багц <strong data-testid="row-balance">{formatHours(row.remainingHours)}/{formatHours(row.totalHours)} цаг</strong> · Чөлөө{" "}
        <strong>{row.leavesLeft}</strong>
        {row.paymentStatus
          ? ` · ${TEACHER_PAYMENT_FLAG_LABELS[row.paymentStatus as keyof typeof TEACHER_PAYMENT_FLAG_LABELS] ?? ""}`
          : ""}
      </p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {row.leaveRequested ? <StatusChip tone="warning">Чөлөө хүссэн</StatusChip> : null}
        {row.isMakeup ? <StatusChip tone="info">Нөхөлт</StatusChip> : null}
        {row.attendanceId && row.packageHours !== null && row.packageHours > 0 ? (
          <span data-testid="row-hours">
            <StatusChip tone="neutral">
              {row.actualFrom && row.actualTo ? `${row.actualFrom}-${row.actualTo} · ` : ""}
              {formatHours(row.packageHours)} академик цаг
            </StatusChip>
          </span>
        ) : null}
      </div>
    </div>
  );
}

// D-70: сурагч төлөвлөснөөс их, бага сууж болно. "Цаг өөрчлөгдсөн" гэж тэмдэглээд хэдээс хэдэн цагийн хооронд
// суусныг бичнэ (24 цагийн систем). Багцаас орсон цагаараа (минут / 40) хасагдаж, цалин бодит цагаар бодогдоно.
function ActualTimeControl({
  name,
  plannedFrom,
  plannedTo,
  academicHourMinutes,
  value,
  onChange,
}: {
  name: string;
  plannedFrom: string;
  plannedTo: string;
  academicHourMinutes: number;
  value: ActualTime | null;
  onChange: (value: ActualTime | null) => void;
}) {
  const minutes = value ? toMinutes(value.to) - toMinutes(value.from) : 0;
  const valid = value !== null && minutes > 0;
  return (
    <div className="w-full rounded-xl bg-background-soft p-3" data-testid="actual-time">
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-mid">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          checked={value !== null}
          aria-label={`${name}: цаг өөрчлөгдсөн`}
          onChange={(e) => onChange(e.target.checked ? { from: plannedFrom, to: plannedTo } : null)}
        />
        Цаг нэмэгдсэн / өөрчлөгдсөн
      </label>
      {value ? (
        <div className="mt-2 grid gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Эхэлсэн</span>
              <TimeSelect24 id={`from-${name}`} label={`${name}: эхэлсэн цаг`} value={value.from} onChange={(from) => onChange({ ...value, from })} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Дууссан</span>
              <TimeSelect24 id={`to-${name}`} label={`${name}: дууссан цаг`} value={value.to} onChange={(to) => onChange({ ...value, to })} />
            </div>
          </div>
          {valid ? (
            <p className="text-sm font-semibold text-foreground-strong" data-testid="actual-preview">
              {minutes} минут = {formatHours(academicHoursOf(minutes, academicHourMinutes))} академик цаг (багцаас хасагдана)
            </p>
          ) : (
            <p role="alert" className="text-sm font-semibold text-danger">
              Дуусах цаг эхлэх цагаас хойш байх ёстой.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

const hmOf = (iso: string) => formatTime(iso);

function EditModal({
  row,
  sheet,
  needsReason,
  onClose,
}: {
  row: AttendanceRowDto;
  sheet: AttendanceSheetDto;
  needsReason: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [present, setPresent] = React.useState(row.present ?? true);
  const initialTime: ActualTime | null = row.actualFrom && row.actualTo ? { from: row.actualFrom, to: row.actualTo } : null;
  const [time, setTime] = React.useState<ActualTime | null>(initialTime);
  const [reason, setReason] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const timeChanged = (time?.from ?? null) !== (initialTime?.from ?? null) || (time?.to ?? null) !== (initialTime?.to ?? null);
  const timeInvalid = present && time !== null && toMinutes(time.to) <= toMinutes(time.from);
  const patch = useMutation({
    mutationFn: () =>
      api.patch(`/attendance/${row.attendanceId}`, {
        present,
        reason: reason.trim() || undefined,
        // Цаг өөрчлөгдсөн бол хоёуланг нь, төлөвлөсөн рүү буцаах бол хоёуланг нь null.
        ...(timeChanged ? { actualFrom: present && time ? time.from : null, actualTo: present && time ? time.to : null } : {}),
      }),
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
          {present ? (
            <ActualTimeControl
              name={row.studentName}
              plannedFrom={hmOf(sheet.lesson.startsAt)}
              plannedTo={hmOf(sheet.lesson.endsAt)}
              academicHourMinutes={sheet.academicHourMinutes}
              value={time}
              onChange={setTime}
            />
          ) : null}
          <p className="text-xs text-muted">
            Төлөв, багц, чөлөө, цалинг сервер дахин тооцно. Засвар зөвхөн энэ мөрөнд нөлөөлнө.
          </p>
          <Field label={needsReason ? "Шалтгаан (заавал)" : "Шалтгаан"} htmlFor="edit-reason">
            <Input id="edit-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FormError message={errorMessage(patch.error)} />
          <Button
            className="w-fit"
            disabled={
              patch.isPending ||
              (needsReason && !reason.trim()) ||
              timeInvalid ||
              (present === row.present && !timeChanged)
            }
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
                    Багц {formatHours(c.remainingHours)} цаг · нөхөх чөлөө {c.makeupsAvailable}
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
  const [times, setTimes] = React.useState<Record<string, ActualTime | null>>({});
  const [reason, setReason] = React.useState("");
  const [editing, setEditing] = React.useState<AttendanceRowDto | null>(null);
  const [makeupOpen, setMakeupOpen] = React.useState(false);
  const [noteRow, setNoteRow] = React.useState<AttendanceRowDto | null>(null);
  const keyRef = React.useRef(crypto.randomUUID());
  const isAdmin = user?.role === "ADMIN";

  const queue = useQueue();
  const queued = queue.find((q) => q.lessonId === lessonId && q.status === "pending");

  const save = useMutation({
    // ФБШ-15: сүлжээгүй үед TanStack Query хүсэлтийг түр зогсоодог. Ирцийг дараалалд хийхийн тулд
    // функц заавал ажиллах ёстой.
    networkMode: "always",
    mutationFn: async (
      entries: { contractId: string; present: boolean; actualFrom?: string; actualTo?: string }[],
    ): Promise<SaveResult> => {
      const body = { entries, reason: reason.trim() || undefined };
      try {
        return await api.put<SaveResult>(`/lessons/${lessonId}/attendance`, body, keyRef.current);
      } catch (error) {
        // ФБШ-15, ADR-007: сүлжээ тасарсан бол ижил Idempotency-Key-тэйгээр төхөөрөмжид хадгална.
        if (isNetworkError(error) && user) {
          await enqueueAttendance({ lessonId, userId: user.id, key: keyRef.current, ...body });
          return { queued: true, entries: [] };
        }
        throw error;
      }
    },
    onSuccess: async (result) => {
      if (result.queued) {
        keyRef.current = crypto.randomUUID();
        return;
      }
      keyRef.current = crypto.randomUUID();
      setMarks({});
      setTimes({});
      await queryClient.invalidateQueries({ queryKey: [SHEET_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-day"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
  // D-70: цаг өөрчлөгдсөн сурагч бүрийн цаг зөв (дуусах нь эхлэхээс хойш) байх ёстой.
  const timeFor = (row: AttendanceRowDto) => (effective(row) ? (times[row.contractId] ?? null) : null);
  const anyTimeInvalid = unsaved.some((r) => {
    const t = timeFor(r);
    return t !== null && toMinutes(t.to) <= toMinutes(t.from);
  });
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

      {queued ? (
        <p
          role="status"
          className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning"
          data-testid="queued-notice"
        >
          Энэ хичээлийн ирц төхөөрөмжид хадгалагдсан, холбогдмогц автоматаар илгээгдэнэ.
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
              {!isAdmin ? (
                <Button variant="ghost" onClick={() => setNoteRow(row)} aria-label={`${row.studentName}: тэмдэглэл`}>
                  Тэмдэглэл
                </Button>
              ) : null}
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
              {!row.attendanceId && effective(row) && canWrite ? (
                <ActualTimeControl
                  name={row.studentName}
                  plannedFrom={hmOf(data.lesson.startsAt)}
                  plannedTo={hmOf(data.lesson.endsAt)}
                  academicHourMinutes={data.academicHourMinutes}
                  value={times[row.contractId] ?? null}
                  onChange={(value) => setTimes((prev) => ({ ...prev, [row.contractId]: value }))}
                />
              ) : null}
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
              disabled={
                unsaved.length === 0 ||
                save.isPending ||
                Boolean(queued) ||
                anyTimeInvalid ||
                (needsReason && !reason.trim())
              }
              onClick={() =>
                save.mutate(
                  unsaved.map((r) => {
                    const t = timeFor(r);
                    return {
                      contractId: r.contractId,
                      present: effective(r),
                      ...(t ? { actualFrom: t.from, actualTo: t.to } : {}),
                    };
                  }),
                )
              }
            >
              Хадгалах
            </Button>
          </div>
        </div>
      ) : null}

      {editing ? (
        <EditModal row={editing} sheet={data} needsReason={needsReason} onClose={() => setEditing(null)} />
      ) : null}
      {noteRow ? (
        <NoteModal
          lessonId={lessonId}
          contractId={noteRow.contractId}
          studentName={noteRow.studentName}
          onClose={() => setNoteRow(null)}
        />
      ) : null}
      {makeupOpen ? (
        <MakeupModal lessonId={lessonId} needsReason={needsReason} onClose={() => setMakeupOpen(false)} />
      ) : null}
    </>
  );
}
