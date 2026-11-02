import {
  CONTRACT_STATUS_LABELS,
  TEACHER_PAYMENT_FLAG_LABELS,
  type ContractStatus,
  type Paginated,
  type TeacherPaymentFlag,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto } from "@/shared/api-client/types";
import { weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pager } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

interface ContractRow {
  id: string;
  studentId: string;
  studentName: string;
  programName: string;
  status: ContractStatus;
  totalVisits: number;
  remainingVisits: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  meetingsCount: number;
  paymentFlag: TeacherPaymentFlag;
  planItems: { position: number; topic: string; doneAt: string | null }[];
  activePause: { startedOn: string; holdSeat: boolean; reason: string } | null;
  classes: { id: string; branchName: string; weekday: number; startTime: string; teacherName: string }[];
}

const todayKey = () => new Date().toISOString().slice(0, 10);

function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["contracts", "classes", "available-classes", "students", "student"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

// ФШ-72, 74: урт хугацааны чөлөө. Эхлэх огноо өнөөдөр эсвэл хойно, шалтгаантай.
function PauseModal({ contract, onClose }: { contract: ContractRow; onClose: () => void }) {
  const invalidate = useInvalidateContracts();
  const [startedOn, setStartedOn] = React.useState(todayKey());
  const [reason, setReason] = React.useState("");
  const [holdSeat, setHoldSeat] = React.useState(true);
  const pause = useMutation({
    mutationFn: () =>
      api.post(`/contracts/${contract.id}/pause`, { startedOn, reason: reason.trim(), holdSeat }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  return (
    <Modal
      open
      title="Урт хугацааны чөлөө"
      description={`${contract.studentName}: гэрээг түр зогсооход ирц бүртгэгдэхгүй, багц, чөлөөний эрх өөрчлөгдөхгүй.`}
      onClose={onClose}
    >
      <div className="grid gap-3.5">
        <Field label="Эхлэх огноо" htmlFor="pause-from">
          <Input
            id="pause-from"
            type="date"
            value={startedOn}
            onChange={(e) => setStartedOn(e.target.value)}
          />
        </Field>
        <Field label="Шалтгаан" htmlFor="pause-reason">
          <Input id="pause-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-mid">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={holdSeat}
            onChange={(e) => setHoldSeat(e.target.checked)}
          />
          Ангийн суудлыг хадгалах
        </label>
        <FormError message={errorMessage(pause.error)} />
        <Button
          className="w-fit"
          disabled={!reason.trim() || !startedOn || pause.isPending}
          onClick={() => pause.mutate()}
        >
          Түр зогсоох
        </Button>
      </div>
    </Modal>
  );
}

// ФШ-75: суудал хадгалаагүй бол үргэлжлүүлэхдээ сул суудалтай анги сонгоно (ФШ-15).
function ResumeModal({ contract, onClose }: { contract: ContractRow; onClose: () => void }) {
  const invalidate = useInvalidateContracts();
  const needsClass = contract.activePause?.holdSeat === false;
  const [resumedOn, setResumedOn] = React.useState(todayKey());
  const [classIds, setClassIds] = React.useState<string[]>([]);
  const classes = useQuery({
    queryKey: ["available-classes", "resume"],
    queryFn: () => api.get<AvailableClassDto[]>("/classes/available"),
    enabled: needsClass,
  });
  const resume = useMutation({
    mutationFn: () =>
      api.post(`/contracts/${contract.id}/resume`, {
        resumedOn,
        classIds: needsClass ? classIds : undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  return (
    <Modal
      open
      title="Сурагчийг үргэлжлүүлэх"
      description={`${contract.studentName}: багцын үлдэгдэл ${contract.remainingVisits}, чөлөө ${contract.leavesLeft} хэвээр.`}
      onClose={onClose}
    >
      <div className="grid gap-3.5">
        <Field label="Үргэлжлүүлэх огноо" htmlFor="resume-on">
          <Input
            id="resume-on"
            type="date"
            value={resumedOn}
            onChange={(e) => setResumedOn(e.target.value)}
          />
        </Field>
        {needsClass ? (
          <div>
            <p className="mb-2 text-sm text-muted">
              Суудал хадгалаагүй тул сул суудалтай анги сонгоно уу:
            </p>
            <ul className="grid gap-2">
              {classes.data?.map((c) => (
                <li key={c.id}>
                  <label
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-3 py-2 text-sm",
                      classIds.includes(c.id) ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={classIds.includes(c.id)}
                      onChange={() =>
                        setClassIds((prev) =>
                          prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                        )
                      }
                    />
                    <span className="flex-1">
                      {weekdayName(c.weekday)} {c.startTime} · {c.branchName} · {c.teacherName}
                    </span>
                    <strong className="text-primary">
                      {c.capacity - c.availableSeats}/{c.capacity}
                    </strong>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <FormError message={errorMessage(resume.error)} />
        <Button
          className="w-fit"
          disabled={resume.isPending || (needsClass && classIds.length === 0)}
          onClick={() => resume.mutate()}
        >
          Үргэлжлүүлэх
        </Button>
      </div>
    </Modal>
  );
}

// ФШ-18: хувийн төлөвлөгөо, сэдвийн дараалал.
function PlanModal({ contract, onClose }: { contract: ContractRow; onClose: () => void }) {
  const invalidate = useInvalidateContracts();
  const [topics, setTopics] = React.useState<string[]>(
    contract.planItems.length ? contract.planItems.map((p) => p.topic) : [""],
  );
  const save = useMutation({
    mutationFn: () =>
      api.put(`/contracts/${contract.id}/plan`, {
        items: topics
          .map((t) => t.trim())
          .filter(Boolean)
          .map((topic, index) => ({ position: index + 1, topic })),
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  return (
    <Modal open title="Хувийн төлөвлөгөө" description={contract.studentName} onClose={onClose}>
      <div className="grid gap-2.5">
        {topics.map((topic, index) => (
          <Input
            key={index}
            aria-label={`Сэдэв ${index + 1}`}
            placeholder={`Сэдэв ${index + 1}`}
            value={topic}
            onChange={(e) =>
              setTopics((prev) => prev.map((t, i) => (i === index ? e.target.value : t)))
            }
          />
        ))}
        <Button variant="secondary" className="w-fit" onClick={() => setTopics((p) => [...p, ""])}>
          Сэдэв нэмэх
        </Button>
        <FormError message={errorMessage(save.error)} />
        <Button className="w-fit" disabled={save.isPending} onClick={() => save.mutate()}>
          Хадгалах
        </Button>
      </div>
    </Modal>
  );
}

export function TeacherStudentsPage() {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [modal, setModal] = React.useState<{
    kind: "pause" | "resume" | "plan";
    contract: ContractRow;
  } | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search.trim()) params.set("search", search.trim());
  const contracts = useQuery({
    queryKey: ["contracts", params.toString()],
    queryFn: () => api.get<Paginated<ContractRow>>(`/contracts?${params.toString()}`),
  });

  return (
    <>
      <PageHeader
        title="Миний сурагчид"
        subtitle="Багц, чөлөө, хувийн төлөвлөгөө"
        action={
          <Link
            to="/teacher/enroll"
            className="inline-flex h-11 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
          >
            Сурагч бүртгэх
          </Link>
        }
      />
      <Input
        aria-label="Сурагчийн нэрээр хайх"
        placeholder="Сурагчийн нэрээр хайх"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-4 max-w-md"
      />
      {contracts.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {contracts.data?.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Сурагч олдсонгүй.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {contracts.data?.items.map((c) => (
          <li key={c.id}>
            <Card className="p-5" data-testid="student-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-foreground-strong">{c.studentName}</h2>
                  <p className="text-sm text-muted">{c.programName}</p>
                </div>
                <StatusChip tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                  {CONTRACT_STATUS_LABELS[c.status]}
                </StatusChip>
              </div>
              <p className="mt-2 text-sm text-mid">
                Багц <strong>{c.remainingVisits}/{c.totalVisits}</strong> · Чөлөө{" "}
                <strong>{c.leavesLeft}</strong>
              </p>
              {c.classes.map((cls) => (
                <p key={cls.id} className="text-sm text-muted">
                  {cls.branchName}, {weekdayName(cls.weekday)} {cls.startTime}
                </p>
              ))}
              {c.activePause ? (
                <p className="mt-1 text-sm text-warning">
                  {c.activePause.startedOn}-аас түр зогссон
                  {c.activePause.holdSeat ? " (суудал хадгалсан)" : " (суудал чөлөөлсөн)"}:{" "}
                  {c.activePause.reason}
                </p>
              ) : null}
              <p className="text-xs text-muted">
                Эцэг эхтэй уулзсан: {c.meetingsCount} · Төлбөр:{" "}
                <strong className={c.paymentFlag === "DEBT" ? "text-warning" : "text-success"}>
                  {TEACHER_PAYMENT_FLAG_LABELS[c.paymentFlag]}
                </strong>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <Link to={`/teacher/students/${c.studentId}`}>Явц, тэмдэглэл</Link>
                </Button>
                <Button variant="secondary" onClick={() => setModal({ kind: "plan", contract: c })}>
                  Төлөвлөгөө
                </Button>
                {c.status === "ACTIVE" ? (
                  <Button variant="secondary" onClick={() => setModal({ kind: "pause", contract: c })}>
                    Урт хугацааны чөлөө
                  </Button>
                ) : null}
                {c.status === "PAUSED" ? (
                  <Button onClick={() => setModal({ kind: "resume", contract: c })}>
                    Үргэлжлүүлэх
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {contracts.data ? (
        <Pager
          page={contracts.data.page}
          limit={contracts.data.limit}
          total={contracts.data.total}
          onPage={setPage}
        />
      ) : null}

      {modal?.kind === "pause" ? (
        <PauseModal contract={modal.contract} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "resume" ? (
        <ResumeModal contract={modal.contract} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "plan" ? (
        <PlanModal contract={modal.contract} onClose={() => setModal(null)} />
      ) : null}
    </>
  );
}
