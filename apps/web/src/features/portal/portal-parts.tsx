import { CONTRACT_STATUS_LABELS } from "@pitoo/contracts";
import * as React from "react";
import { useSearchParams } from "react-router";
import { ApiError } from "@/shared/api-client/client";
import type { LessonDto } from "@/shared/api-client/types";
import { weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useRequestLeave, type PortalContract, type PortalStudent } from "./portal-api";
import { formatHours } from "@/shared/format/hours";

// Хэд хэдэн хүүхэдтэй эцэг эх "?child=" параметрээр хүүхдээ сонгоно (хуудас шинэчлэгдэхэд хэвээр).
export function useSelectedChild(students: PortalStudent[] | undefined) {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("child");
  const selected = students?.find((s) => s.studentId === wanted) ?? students?.[0];
  const select = (studentId: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("child", studentId);
        return next;
      },
      { replace: true },
    );
  return { selected, select };
}

export function ChildPicker({
  students,
  selectedId,
  onSelect,
}: {
  students: PortalStudent[];
  selectedId: string | undefined;
  onSelect: (studentId: string) => void;
}) {
  if (students.length < 2) return null;
  return (
    <div className="mb-4 mt-4 flex flex-wrap gap-2 sm:mb-6" role="tablist" aria-label="Хүүхэд сонгох">
      {students.map((student) => (
        <button
          key={student.studentId}
          type="button"
          role="tab"
          aria-selected={student.studentId === selectedId}
          onClick={() => onSelect(student.studentId)}
          className={cn(
            "min-h-11 rounded-full border px-5 text-sm font-medium transition-colors",
            student.studentId === selectedId
              ? "border-brand-700 bg-brand-700 text-white shadow-[0_10px_24px_-10px_rgba(139,26,26,0.7)]"
              : "pt-glass border-transparent text-ink-700 hover:bg-white",
          )}
        >
          {student.fullName}
        </button>
      ))}
    </div>
  );
}

export function errorText(error: unknown) {
  return error instanceof ApiError ? error.problem.detail : "Алдаа гарлаа.";
}

export function PortalLoading({ query }: { query: { isLoading: boolean; isError: boolean } }) {
  if (query.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        Мэдээллийг ачаалж чадсангүй.
      </p>
    );
  return null;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
      {children}
    </p>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-background-soft" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

// Багцын үлдэгдэл, чөлөөний эрх, анги. Үнэ, төлбөр энд орохгүй (ФШ-66).
export function ContractSummary({ contract }: { contract: PortalContract }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-foreground-strong">
          {contract.programName}
        </h3>
        <StatusChip tone={contract.status === "ACTIVE" ? "success" : "neutral"}>
          {CONTRACT_STATUS_LABELS[contract.status]}
        </StatusChip>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Багцын үлдэгдэл
          </dt>
          <dd className="mt-1 text-2xl font-bold text-foreground-strong">
            {formatHours(contract.remainingHours)}
            <span className="text-base font-semibold text-muted"> / {formatHours(contract.totalHours)} цаг</span>
          </dd>
          <Meter value={contract.remainingHours} max={contract.totalHours} />
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
            Чөлөөний эрх
          </dt>
          <dd className="mt-1 text-2xl font-bold text-foreground-strong">{contract.leavesLeft}</dd>
          {contract.freeReviewsLeft > 0 ? (
            <p className="mt-1 text-xs text-muted">
              Үнэгүй давтлагын эрх: {contract.freeReviewsLeft}
            </p>
          ) : null}
        </div>
      </dl>

      {contract.classes.length > 0 ? (
        <ul className="mt-4 grid gap-1 border-t border-border-warm pt-3 text-sm text-mid">
          {contract.classes.map((cls) => (
            <li key={cls.id}>
              {weekdayName(cls.weekday)} {cls.startTime} · {cls.teacherName} · {cls.branchName}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

// ФШ-30: хичээл эхлэхээс өмнө чөлөө хүсэх. Чөлөөний эрхийн тооцоо ирц бүртгэхэд хийгдэнэ.
export function LeaveRequestAction({
  lesson,
  contractId,
  requested,
}: {
  lesson: LessonDto;
  contractId: string | undefined;
  requested: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const leave = useRequestLeave();

  if (lesson.status !== "SCHEDULED" || new Date(lesson.startsAt).getTime() <= Date.now()) {
    return null;
  }
  if (requested) return <StatusChip tone="warning">Чөлөө хүссэн</StatusChip>;
  if (!contractId) return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          leave.reset();
          setOpen(true);
        }}
      >
        Чөлөө хүсэх
      </Button>
      <ConfirmDialog
        open={open}
        title="Чөлөө хүсэх үү?"
        description={`${
          leave.error ? errorText(leave.error) + " " : ""
        }Хариуцсан багшид мэдэгдэл очно. Чөлөөний эрхийн тооцоо ирц бүртгэгдэхэд хийгдэнэ.`}
        confirmLabel="Чөлөө хүсэх"
        busy={leave.isPending}
        onConfirm={() =>
          leave.mutate({ contractId, lessonId: lesson.id }, { onSuccess: () => setOpen(false) })
        }
        onClose={() => setOpen(false)}
      />
    </>
  );
}
