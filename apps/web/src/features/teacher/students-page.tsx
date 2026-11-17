import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
  type Paginated,
  type TeacherPaymentFlag,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto } from "@/shared/api-client/types";
import { weekdayName, localDateKey } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Pager } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";
import { useAuth } from "@/features/auth/auth-context";
import { StudentTransferModal } from "./student-transfer-modal";
import { CategoryManager, StudentCategorySelect } from "./categories-ui";
import { formatHours } from "@/shared/format/hours";

interface ContractRow {
  id: string;
  studentId: string;
  studentName: string;
  programName: string;
  status: ContractStatus;
  totalHours: number;
  remainingHours: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  meetingsCount: number;
  paymentFlag: TeacherPaymentFlag;
  planItems: { position: number; topic: string; doneAt: string | null }[];
  activePause: { startedOn: string; holdSeat: boolean; reason: string } | null;
  classes: { id: string; branchId: string; branchName: string; weekday: number; startTime: string; teacherId: string; teacherName: string }[];
}

// Улаанбаатарын өнөөдөр (UTC биш): шөнийн 00:00-08:00-д UTC огноо өчигдөр байдаг.
const todayKey = () => localDateKey(new Date());

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
      description={`${contract.studentName}: багцын үлдэгдэл ${formatHours(contract.remainingHours)} цаг, чөлөө ${contract.leavesLeft} хэвээр.`}
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
  // Дээд мөрний хайлт `?q=`-ээр орж ирнэ.
  const [urlParams] = useSearchParams();
  const [search, setSearch] = React.useState(urlParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const { user } = useAuth();
  // transfer: null бол хаалттай, "search" бол хайлттай цонх, ContractRow бол тухайн сурагч бэлэн.
  const [transfer, setTransfer] = React.useState<ContractRow | "search" | null>(null);
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
        subtitle="Багц, чөлөө, төлбөрийн байдал"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setTransfer("search")}>
              Сурагч шилжүүлэх
            </Button>
            <Button asChild className="rounded-xl">
              <Link to="/teacher/enroll">Сурагч бүртгэх</Link>
            </Button>
          </div>
        }
      />
      <CategoryManager />
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
      <ul className="grid gap-3 xl:grid-cols-2">
        {contracts.data?.items.map((c) => (
          <li key={c.id}>
            <Card className="h-full p-4 shadow-soft" data-testid="student-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-bold leading-tight text-foreground-strong">{c.studentName}</h2>
                  <p className="truncate text-sm text-muted">{c.programName}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {c.status !== "ACTIVE" ? <StatusChip tone="neutral">{CONTRACT_STATUS_LABELS[c.status]}</StatusChip> : null}
                  <StatusChip tone={c.paymentFlag === "DEBT" ? "warning" : "success"}>
                    {c.paymentFlag === "DEBT" ? "Үлдэгдэлтэй" : "Төлсөн"}
                  </StatusChip>
                </div>
              </div>

              <p className="mt-2.5 text-sm text-mid">
                Багц <strong>{formatHours(c.remainingHours)}/{formatHours(c.totalHours)} цаг</strong> · Чөлөө{" "}
                <strong>{c.leavesLeft}</strong>
              </p>
              {c.classes.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Хичээлийн цаг">
                  {c.classes.map((cls) => (
                    <li key={cls.id} className="rounded-lg bg-background-soft px-2.5 py-1 text-[0.8125rem] font-medium text-mid">
                      {weekdayName(cls.weekday)} {cls.startTime}
                      {cls.teacherId !== user?.id ? <span className="text-muted"> · {cls.teacherName}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.activePause ? (
                <p className="mt-2 text-[0.8125rem] text-warning">
                  {c.activePause.startedOn}-аас түр зогссон
                  {c.activePause.holdSeat ? " (суудал хадгалсан)" : " (суудал чөлөөлсөн)"}: {c.activePause.reason}
                </p>
              ) : null}
              <StudentCategorySelect studentId={c.studentId} studentName={c.studentName} />

              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-warm pt-3">
                <Button asChild variant="secondary" size="sm" className="rounded-lg">
                  <Link to={`/teacher/students/${c.studentId}`}>Явц, тэмдэглэл</Link>
                </Button>
                <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => setModal({ kind: "plan", contract: c })}>
                  Төлөвлөгөө
                </Button>
                {c.status === "ACTIVE" ? (
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => setTransfer(c)}>
                    Шилжүүлэх
                  </Button>
                ) : null}
                {c.status === "ACTIVE" ? (
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => setModal({ kind: "pause", contract: c })}>
                    Урт хугацааны чөлөө
                  </Button>
                ) : null}
                {c.status === "PAUSED" ? (
                  <Button size="sm" className="rounded-lg" onClick={() => setModal({ kind: "resume", contract: c })}>
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

      {transfer !== null ? (
        <StudentTransferModal
          initial={
            transfer === "search"
              ? undefined
              : {
                  id: transfer.id,
                  studentName: transfer.studentName,
                  programName: transfer.programName,
                  status: transfer.status,
                  classes: transfer.classes,
                }
          }
          onClose={() => setTransfer(null)}
        />
      ) : null}
      {modal?.kind === "pause" ? <PauseModal contract={modal.contract} onClose={() => setModal(null)} /> : null}
      {modal?.kind === "resume" ? <ResumeModal contract={modal.contract} onClose={() => setModal(null)} /> : null}
      {modal?.kind === "plan" ? <PlanModal contract={modal.contract} onClose={() => setModal(null)} /> : null}
    </>
  );
}
