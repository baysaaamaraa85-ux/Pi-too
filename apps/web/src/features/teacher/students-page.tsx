import type { Paginated } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, SearchX, SlidersHorizontal, UserPlus } from "lucide-react";
import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage } from "@/features/admin/list-kit";
import { usePublicOverview } from "@/features/public/public-api";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto } from "@/shared/api-client/types";
import { weekdayName, localDateKey } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Pager } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { cn } from "@/shared/ui/utils";
import { useAuth } from "@/features/auth/auth-context";
import { StudentTransferModal } from "./student-transfer-modal";
import { CategoryManager, useTeacherCategories } from "./categories-ui";
import { StudentRow, type ContractRow } from "./student-accordion";
import { formatHours } from "@/shared/format/hours";
import "./students.css";

// D-103: нэг хуудсанд 100 хүртэл сурагч ачаална (API-ийн дээд хязгаар). Категори, төлбөрийн шүүлт энэ жагсаалт дотор ажиллана.
const PAGE_LIMIT = 100;

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

// Шүүлтүүр: "all" бүгд, "__none" категоригүй, "__due" төлбөр үлдэгдэлтэй, бусад нь категорийн id.
type Filter = "all" | "__none" | "__due" | (string & {});

export function TeacherStudentsPage() {
  // Дээд мөрний хайлт `?q=`-ээр орж ирнэ.
  const [urlParams] = useSearchParams();
  const [search, setSearch] = React.useState(urlParams.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [categoriesOpen, setCategoriesOpen] = React.useState(false);
  const { user } = useAuth();
  const overview = usePublicOverview().data;
  const categories = useTeacherCategories().data;
  // transfer: null бол хаалттай, "search" бол хайлттай цонх, ContractRow бол тухайн сурагч бэлэн.
  const [transfer, setTransfer] = React.useState<ContractRow | "search" | null>(null);
  const [modal, setModal] = React.useState<{
    kind: "pause" | "resume" | "plan";
    contract: ContractRow;
  } | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
  if (search.trim()) params.set("search", search.trim());
  const contracts = useQuery({
    queryKey: ["contracts", params.toString()],
    queryFn: () => api.get<Paginated<ContractRow>>(`/contracts?${params.toString()}`),
  });

  const items = contracts.data?.items ?? [];
  const assignments = categories?.assignments ?? [];
  const categoriesOf = (studentId: string) =>
    assignments.filter((a) => a.studentId === studentId).map((a) => a.categoryId);

  // Идэвхтэй сурагч эхэнд, дараа нь нэрээр.
  const sorted = React.useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || a.studentName.localeCompare(b.studentName, "mn"),
      ),
    [items],
  );

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Бүгд", count: items.length },
    ...(categories?.categories ?? []).map((c) => ({
      key: c.id as Filter,
      label: c.name,
      count: items.filter((x) => categoriesOf(x.studentId).includes(c.id)).length,
    })),
    { key: "__none", label: "Категоригүй", count: items.filter((x) => categoriesOf(x.studentId).length === 0).length },
    { key: "__due", label: "Төлбөр үлдэгдэлтэй", count: items.filter((x) => x.paymentFlag === "DEBT").length },
  ];
  // Устгагдсан категорийн шүүлт үлдсэн бол бүгд рүү буцна.
  const activeFilter: Filter = chips.some((c) => c.key === filter) ? filter : "all";

  const rows = sorted.filter((x) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "__none") return categoriesOf(x.studentId).length === 0;
    if (activeFilter === "__due") return x.paymentFlag === "DEBT";
    return categoriesOf(x.studentId).includes(activeFilter);
  });

  // Дэлгэрэнгүй нээлттэй мөрүүд. Анх ачаалахад эхний мөр нээлттэй (загвараар).
  const [openIds, setOpenIds] = React.useState<Set<string>>(new Set());
  const initialOpen = React.useRef(false);
  React.useEffect(() => {
    if (initialOpen.current || sorted.length === 0) return;
    initialOpen.current = true;
    setOpenIds(new Set([sorted[0]!.id]));
  }, [sorted]);
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const total = contracts.data?.total ?? 0;
  const activeCount = items.filter((x) => x.status === "ACTIVE").length;
  const dueCount = items.filter((x) => x.paymentFlag === "DEBT").length;

  return (
    <>
      {/* Толгой */}
      <section className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end lg:mt-6">
        <div>
          <p className="pt-word block text-[12px] font-semibold tracking-[0.18em] text-brand-700" style={{ display: "block", animationDelay: "0.05s" }}>
            СУРАГЧИД
          </p>
          <h1
            className="pt-word pt-tight mt-3 block text-[40px] font-semibold leading-none sm:text-[54px]"
            style={{ display: "block", animationDelay: "0.15s" }}
          >
            Миний сурагчид
          </h1>
          <p className="pt-word pt-num mt-3 block text-[15.5px] text-ink-500" style={{ display: "block", animationDelay: "0.3s" }} data-testid="students-summary">
            {contracts.data
              ? `${total} сурагч · ${activeCount} идэвхтэй · ${dueCount} нь төлбөрийн үлдэгдэлтэй`
              : "Багц, чөлөө, төлбөрийн байдал"}
          </p>
        </div>
        <div className="pt-word flex-wrap gap-2 self-start sm:self-end" style={{ display: "flex", animationDelay: "0.4s" }}>
          <button
            type="button"
            onClick={() => setTransfer("search")}
            className="pt-glass inline-flex h-12 items-center rounded-full px-5 text-[14.5px] font-semibold text-ink-700 transition hover:bg-white"
          >
            Сурагч шилжүүлэх
          </button>
          <Link
            to="/teacher/enroll"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-700 pl-4 pr-5 text-[14.5px] font-semibold text-white shadow-[0_14px_28px_-12px_rgba(139,26,26,0.8)] transition hover:bg-brand-800"
          >
            <UserPlus className="size-[18px]" aria-hidden="true" />
            Сурагч бүртгэх
          </Link>
        </div>
      </section>

      {/* Хайлт, шүүлтүүр */}
      <section className="ts-card ts-in mt-6 p-3 sm:p-4" style={{ animationDelay: "0.35s" }} aria-label="Шүүлтүүр">
        <label className="relative block">
          <span className="sr-only">Сурагчийн нэрээр хайх</span>
          <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            type="search"
            aria-label="Сурагчийн нэрээр хайх"
            placeholder="Сурагчийн нэрээр хайх"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-12 w-full rounded-full border border-paper-3 bg-paper pl-11 pr-4 text-[14.5px] transition placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Категорийн шүүлтүүр">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              className="ts-chip"
              aria-pressed={c.key === activeFilter}
              onClick={() => setFilter(c.key)}
              data-testid="students-filter"
            >
              {c.label}
              <span className="ts-n pt-num">{c.count}</span>
            </button>
          ))}
          <button type="button" className="ts-chip ts-chip-dashed" onClick={() => setCategoriesOpen(true)} data-testid="categories-open">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Категори
          </button>
        </div>
      </section>

      <p className="mb-3 mt-6 text-[13px] text-ink-500" aria-live="polite">
        {contracts.isLoading ? "Ачаалж байна..." : `${rows.length} сурагч харагдаж байна`}
      </p>

      {contracts.isError ? (
        <p role="alert" className="mb-3 text-sm font-semibold text-danger">
          Сурагчдын жагсаалтыг ачаалж чадсангүй.
        </p>
      ) : null}

      <section className="space-y-3">
        {rows.map((c, i) => (
          <StudentRow
            key={c.id}
            contract={c}
            index={i}
            open={openIds.has(c.id)}
            onToggle={() => toggle(c.id)}
            userId={user?.id}
            categories={categories}
            lowHours={overview?.packageEndingHours}
            maxLeaves={overview?.leaves}
            onPlan={() => setModal({ kind: "plan", contract: c })}
            onTransfer={() => setTransfer(c)}
            onPause={() => setModal({ kind: "pause", contract: c })}
            onResume={() => setModal({ kind: "resume", contract: c })}
          />
        ))}
      </section>

      {contracts.data && rows.length === 0 ? (
        <div className="ts-card p-10 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-paper-2 text-ink-400">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-4 font-semibold">Сурагч олдсонгүй</p>
          <p className="mt-1 text-[14px] text-ink-500">Хайлт эсвэл категорийн шүүлтүүрээ өөрчилж үзээрэй.</p>
        </div>
      ) : null}

      {contracts.data ? (
        <Pager
          page={contracts.data.page}
          limit={contracts.data.limit}
          total={contracts.data.total}
          onPage={setPage}
        />
      ) : null}

      {categoriesOpen ? (
        <Modal
          open
          title="Миний категори"
          description="Сурагчдаа өөрийн нэрлэсэн категориор ангилна."
          onClose={() => setCategoriesOpen(false)}
        >
          <CategoryManager bare />
        </Modal>
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
