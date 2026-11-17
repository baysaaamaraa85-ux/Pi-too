import {
  PAYMENT_CHANNEL_LABELS,
  PAYMENT_STATUS_LABELS,
  type ClaimDto,
  type DebtRowDto,
  type Paginated,
  type PaymentChannel,
  type PaymentDto,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage, useBranches } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatDate, localDateKey } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import { cn } from "@/shared/ui/utils";

type Tab = "claims" | "debts" | "payments";

function useInvalidatePayments() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["claims", "debts", "payments", "students", "student", "portal"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

// ФШ-46: төлбөр бүртгэх (шилжүүлгийн мэдэгдлийг баталгаажуулахад claimId-тай).
export function RecordPaymentModal({
  contractId,
  studentName,
  defaultAmount,
  claimId,
  onClose,
}: {
  contractId: string;
  studentName: string;
  defaultAmount?: string;
  claimId?: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidatePayments();
  const [amount, setAmount] = React.useState(defaultAmount ? String(Number(defaultAmount)) : "");
  const [paidAt, setPaidAt] = React.useState(localDateKey(new Date()));
  const [channel, setChannel] = React.useState<PaymentChannel>("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const keyRef = React.useRef(crypto.randomUUID());

  const save = useMutation({
    mutationFn: () =>
      api.post(
        claimId ? `/payment-claims/${claimId}/confirm` : `/contracts/${contractId}/payments`,
        {
          amount: amount.includes(".") ? amount : `${amount}.00`,
          paidAt,
          channel,
          reference: reference.trim() || undefined,
        },
        keyRef.current,
      ),
    onSuccess: async () => {
      keyRef.current = crypto.randomUUID();
      await invalidate();
      onClose();
    },
  });

  return (
    <Modal
      open
      title={claimId ? `Шилжүүлгийг баталгаажуулах: ${studentName}` : `Төлбөр бүртгэх: ${studentName}`}
      description="Банкны хуулгаас гүйлгээг олж, дүн, огноог ижилхэн бүртгэнэ."
      onClose={onClose}
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Дүн (₮)" htmlFor="pay-amount">
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Төлсөн огноо" htmlFor="pay-date">
          <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Суваг" htmlFor="pay-channel">
          <Select id="pay-channel" value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
            {(Object.keys(PAYMENT_CHANNEL_LABELS) as PaymentChannel[]).map((c) => (
              <option key={c} value={c}>
                {PAYMENT_CHANNEL_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Гүйлгээний утга" htmlFor="pay-ref">
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <FormError message={errorMessage(save.error)} />
        <Button type="submit" className="w-fit" disabled={!/^\d+(\.\d{1,2})?$/.test(amount) || save.isPending}>
          {claimId ? "Баталгаажуулах" : "Бүртгэх"}
        </Button>
      </form>
    </Modal>
  );
}

function ClaimsTab() {
  const claims = useQuery({
    queryKey: ["claims", "PENDING"],
    queryFn: () => api.get<ClaimDto[]>("/payment-claims?status=PENDING"),
  });
  const invalidate = useInvalidatePayments();
  const [confirming, setConfirming] = React.useState<ClaimDto | null>(null);
  const [rejecting, setRejecting] = React.useState<ClaimDto | null>(null);
  const [reason, setReason] = React.useState("");
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/payment-claims/${id}/reject`, { reason }),
    onSuccess: async () => {
      setRejecting(null);
      setReason("");
      await invalidate();
    },
  });

  return (
    <>
      {claims.data?.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          Хүлээгдэж буй шилжүүлгийн мэдэгдэл алга.
        </p>
      ) : null}
      <ul className="grid gap-3" data-testid="claims-list">
        {claims.data?.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border-warm bg-surface p-4 shadow-md" data-testid="claim">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-foreground-strong">{c.studentName}</p>
                <p className="text-sm text-muted">
                  {c.programName} · {c.parentName} ({c.parentPhone}) · {formatDate(c.claimedAt)}
                </p>
                <p className="text-sm text-mid">Төлөх үлдэгдэл: {formatMoney(c.balance)}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setConfirming(c)}>Батлах</Button>
                <Button variant="secondary" onClick={() => setRejecting(c)}>
                  Олдсонгүй
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {confirming ? (
        <RecordPaymentModal
          contractId={confirming.contractId}
          studentName={confirming.studentName}
          defaultAmount={confirming.balance}
          claimId={confirming.id}
          onClose={() => setConfirming(null)}
        />
      ) : null}
      {rejecting ? (
        <Modal open title={`Гүйлгээ олдсонгүй: ${rejecting.studentName}`} onClose={() => setRejecting(null)}>
          <div className="grid gap-3.5">
            <Field label="Шалтгаан (эцэг эхэд очно)" htmlFor="rej-reason">
              <Input id="rej-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <FormError message={errorMessage(reject.error)} />
            <Button className="w-fit" disabled={!reason.trim() || reject.isPending} onClick={() => reject.mutate(rejecting.id)}>
              Татгалзах
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function DebtsTab() {
  const branches = useBranches();
  const [branchId, setBranchId] = React.useState("");
  const [sinceDays, setSinceDays] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [paying, setPaying] = React.useState<DebtRowDto | null>(null);
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (branchId) params.set("branchId", branchId);
  if (sinceDays) params.set("sinceDays", sinceDays);
  if (search.trim()) params.set("search", search.trim());
  const debts = useQuery({
    queryKey: ["debts", params.toString()],
    queryFn: () => api.get<Paginated<DebtRowDto> & { totalDebt: string }>(`/debts?${params.toString()}`),
  });

  const columns: Column<DebtRowDto>[] = [
    { key: "student", header: "Сурагч", cell: (r) => <strong>{r.studentName}</strong> },
    { key: "program", header: "Хөтөлбөр", cell: (r) => r.programName },
    { key: "branch", header: "Салбар", cell: (r) => r.branches.join(", ") || "-" },
    { key: "teacher", header: "Багш", cell: (r) => r.teachers.join(", ") || "-" },
    { key: "price", header: "Үнэ", cell: (r) => formatMoney(r.price) },
    { key: "paid", header: "Төлсөн", cell: (r) => formatMoney(r.paid) },
    {
      key: "balance",
      header: "Өр",
      className: "font-bold text-danger",
      cell: (r) => <span data-testid="debt-balance">{formatMoney(r.balance)}</span>,
    },
    { key: "status", header: "Төлөв", cell: (r) => <StatusChip tone="warning">{PAYMENT_STATUS_LABELS[r.status]}</StatusChip> },
    {
      key: "action",
      header: "",
      cell: (r) => (
        <Button variant="secondary" onClick={() => setPaying(r)}>
          Төлбөр бүртгэх
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Сурагч, эцэг эхийн нэр, утасаар хайх" htmlFor="debt-search">
          <Input id="debt-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Салбар" htmlFor="debt-branch">
          <Select id="debt-branch" value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(1); }}>
            <option value="">Бүх салбар</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Гэрээ эхэлснээс хойш (хоног)" htmlFor="debt-days">
          <Input id="debt-days" inputMode="numeric" value={sinceDays} onChange={(e) => { setSinceDays(e.target.value.replace(/\D/g, "")); setPage(1); }} />
        </Field>
      </div>
      {debts.data ? (
        <p className="mb-3 text-sm font-semibold text-mid" data-testid="total-debt">
          Нийт өр: {formatMoney(debts.data.totalDebt)} ({debts.data.total} гэрээ)
        </p>
      ) : null}
      {debts.data ? (
        <>
          <DataTable columns={columns} rows={debts.data.items} rowKey={(r) => r.contractId} empty="Өртэй гэрээ алга." />
          <Pager page={debts.data.page} limit={debts.data.limit} total={debts.data.total} onPage={setPage} />
        </>
      ) : null}
      {paying ? (
        <RecordPaymentModal
          contractId={paying.contractId}
          studentName={paying.studentName}
          defaultAmount={paying.balance}
          onClose={() => setPaying(null)}
        />
      ) : null}
    </>
  );
}

function PaymentsTab() {
  const invalidate = useInvalidatePayments();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [cancelling, setCancelling] = React.useState<PaymentDto | null>(null);
  const [reason, setReason] = React.useState("");
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search.trim()) params.set("search", search.trim());
  const payments = useQuery({
    queryKey: ["payments", params.toString()],
    queryFn: () => api.get<Paginated<PaymentDto>>(`/payments?${params.toString()}`),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/cancel`, { reason }),
    onSuccess: async () => {
      setCancelling(null);
      setReason("");
      await invalidate();
    },
  });

  const columns: Column<PaymentDto>[] = [
    { key: "date", header: "Огноо", cell: (p) => formatDate(p.paidAt) },
    { key: "student", header: "Сурагч", cell: (p) => <strong>{p.studentName}</strong> },
    { key: "program", header: "Хөтөлбөр", cell: (p) => p.programName },
    { key: "channel", header: "Суваг", cell: (p) => PAYMENT_CHANNEL_LABELS[p.channel] },
    { key: "ref", header: "Гүйлгээний утга", cell: (p) => p.reference ?? "-" },
    {
      key: "amount",
      header: "Дүн",
      cell: (p) => (
        <span className={cn("font-semibold", p.status === "CANCELLED" && "text-muted line-through")} data-testid="payment-amount">
          {formatMoney(p.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Төлөв",
      cell: (p) =>
        p.status === "CANCELLED" ? (
          <StatusChip tone="neutral">Цуцалсан: {p.cancelReason}</StatusChip>
        ) : (
          <StatusChip tone="success">Хүчинтэй</StatusChip>
        ),
    },
    {
      key: "action",
      header: "",
      cell: (p) =>
        p.status === "ACTIVE" ? (
          <Button variant="secondary" onClick={() => setCancelling(p)}>
            Цуцлах
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <Input
        aria-label="Сурагчийн нэрээр хайх"
        placeholder="Сурагчийн нэрээр хайх"
        className="mb-4 max-w-md"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />
      {payments.data ? (
        <>
          <DataTable columns={columns} rows={payments.data.items} rowKey={(p) => p.id} empty="Төлбөрийн бичлэг алга." />
          <Pager page={payments.data.page} limit={payments.data.limit} total={payments.data.total} onPage={setPage} />
        </>
      ) : null}
      {cancelling ? (
        <Modal
          open
          title="Төлбөр цуцлах уу?"
          description={`${cancelling.studentName}: ${formatMoney(cancelling.amount)}. Бичлэг устахгүй, "цуцалсан" гэж үлдэж үлдэгдлийн тооцоонд орохгүй.`}
          onClose={() => setCancelling(null)}
        >
          <div className="grid gap-3.5">
            <Field label="Цуцлах шалтгаан (заавал)" htmlFor="cancel-reason">
              <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <FormError message={errorMessage(cancel.error)} />
            <Button
              className="w-fit"
              disabled={!reason.trim() || cancel.isPending}
              onClick={() => cancel.mutate(cancelling.id)}
            >
              Цуцлах
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

// Шинэ шаардлага 1.1: админы "Төлбөр" хуудас. ФШ-46...48, 52, 76.
export function AdminPaymentsPage() {
  // Самбарын картаас ?tab=debts гэж ирнэ (ФШ-68).
  const [params] = useSearchParams();
  const initial = params.get("tab");
  const [tab, setTab] = React.useState<Tab>(
    initial === "debts" || initial === "payments" ? initial : "claims",
  );
  const tabs: { key: Tab; label: string }[] = [
    { key: "claims", label: "Хүлээгдэж буй төлбөр" },
    { key: "debts", label: "Өртэй гэрээ" },
    { key: "payments", label: "Төлбөрийн бүртгэл" },
  ];
  return (
    <>
      <PageHeader title="Төлбөр" subtitle="Шилжүүлгийн мэдэгдэл, өр, төлбөрийн бүртгэл" />
      <div role="tablist" aria-label="Төлбөрийн хэсгүүд" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-mid hover:border-primary hover:text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "claims" ? <ClaimsTab /> : null}
      {tab === "debts" ? <DebtsTab /> : null}
      {tab === "payments" ? <PaymentsTab /> : null}
    </>
  );
}
