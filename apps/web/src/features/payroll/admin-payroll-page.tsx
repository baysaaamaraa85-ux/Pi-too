import { LEDGER_TYPE_LABELS, type LedgerType } from "@pitoo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { errorMessage, useBranches } from "@/features/admin/list-kit";
import { ApiError, api, downloadFile } from "@/shared/api-client/client";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DataTable, Pager } from "@/shared/ui/data-table";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import { BalanceCards, ledgerColumns } from "./payroll-parts";
import { ledgerQueryString, useLedger, usePayrollSummary, type LedgerFilters } from "./payroll-api";

interface PayoutResult {
  id: string;
  balance: string;
}

// ФШ-55, ФБШ-31, 3.8.3: мөнгө олгох. Үлдэгдлээс их эсвэл ирц бөглөгдөөгүй хичээлтэй бол
// сервер 409 буцаана, админ баталгаажуулсан үед л дахин илгээнэ.
function PayoutModal({
  teacherId,
  teacherName,
  onClose,
}: {
  teacherId: string;
  teacherName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [warning, setWarning] = React.useState<string | null>(null);
  const keyRef = React.useRef(crypto.randomUUID());

  const pay = useMutation({
    mutationFn: (confirm: boolean) =>
      api.post<PayoutResult>(
        "/payouts",
        {
          teacherId,
          amount: amount.includes(".") ? amount : `${amount}.00`,
          note: note.trim() || undefined,
          confirm: confirm || undefined,
        },
        keyRef.current,
      ),
    onSuccess: async () => {
      keyRef.current = crypto.randomUUID();
      await queryClient.invalidateQueries({ queryKey: ["ledger"] });
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.problem.type.endsWith("payout-needs-confirmation")) {
        setWarning(error.problem.detail);
        // 409 хариу хадгалагдаагүй тул түлхүүрийг шинэчилж болно, гэхдээ ижил түлхүүр аюулгүй.
      }
    },
  });

  return (
    <>
      <Modal
        open
        title={`Мөнгө олгох: ${teacherName}`}
        description="Цалин, урьдчилгаа ялгаагүй олгосон бүх мөнгө үлдэгдлээс хасагдана."
        onClose={onClose}
      >
        <form
          className="grid gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            pay.mutate(false);
          }}
        >
          <Field label="Дүн (₮)" htmlFor="payout-amount" hint="Жишээ нь 50000">
            <Input
              id="payout-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Тэмдэглэл (сонголттой)" htmlFor="payout-note">
            <Input id="payout-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <FormError message={warning ? null : errorMessage(pay.error)} />
          <Button type="submit" className="w-fit" disabled={!/^\d+(\.\d{1,2})?$/.test(amount) || pay.isPending}>
            Олгох
          </Button>
        </form>
      </Modal>
      <ConfirmDialog
        open={warning !== null}
        title="Олголтыг баталгаажуулах уу?"
        description={warning ?? ""}
        confirmLabel="Тийм, олгоно"
        busy={pay.isPending}
        onConfirm={() => pay.mutate(true)}
        onClose={() => setWarning(null)}
      />
    </>
  );
}

// Шинэ шаардлага 1.6: админы "Цалин" хуудас.
export function AdminPayrollPage() {
  const branches = useBranches();
  // Самбарын картаас ?negative=1 гэж ирнэ: зөвхөн сөрөг үлдэгдэлтэй багш нар (ФШ-68).
  const [searchParams] = useSearchParams();
  const onlyNegative = searchParams.get("negative") === "1";
  const [filters, setFilters] = React.useState<LedgerFilters>({ page: 1 });
  const [paying, setPaying] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const update = (patch: Partial<Omit<LedgerFilters, "page">>) =>
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));

  const summary = usePayrollSummary(filters.from, filters.to);
  const ledger = useLedger(filters);
  const teacher = summary.data?.find((t) => t.teacherId === filters.teacherId);

  const exportFile = async (format: "xlsx" | "pdf") => {
    setExportError(null);
    try {
      const query = new URLSearchParams(ledgerQueryString(filters));
      query.delete("page");
      query.delete("limit");
      query.set("format", format);
      await downloadFile(`/reports/payroll?${query.toString()}`, `tsalin-tailan.${format}`);
    } catch (error) {
      setExportError(errorMessage(error) ?? "Файл татаж чадсангүй.");
    }
  };

  return (
    <>
      <PageHeader
        title="Цалин"
        subtitle="Олсон цалин, олгосон мөнгө, үлдэгдэл"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void exportFile("xlsx")}>
              Excel
            </Button>
            <Button variant="secondary" onClick={() => void exportFile("pdf")}>
              PDF
            </Button>
            <Button disabled={!filters.teacherId} onClick={() => setPaying(true)}>
              Мөнгө олгох
            </Button>
          </div>
        }
      />
      {exportError ? <FormError message={exportError} /> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Багш" htmlFor="pr-teacher">
          <Select
            id="pr-teacher"
            value={filters.teacherId ?? ""}
            onChange={(e) => update({ teacherId: e.target.value || undefined })}
          >
            <option value="">{onlyNegative ? "Сөрөг үлдэгдэлтэй бүх багш" : "Бүх багш"}</option>
            {summary.data?.filter((t) => !onlyNegative || Number(t.balance) < 0).map((t) => (
              <option key={t.teacherId} value={t.teacherId}>
                {t.fullName}
                {Number(t.balance) < 0 ? " (сөрөг үлдэгдэл)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Салбар" htmlFor="pr-branch">
          <Select
            id="pr-branch"
            value={filters.branchId ?? ""}
            onChange={(e) => update({ branchId: e.target.value || undefined })}
          >
            <option value="">Бүх салбар</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Төрөл" htmlFor="pr-type">
          <Select
            id="pr-type"
            value={filters.type ?? ""}
            onChange={(e) => update({ type: e.target.value || undefined })}
          >
            <option value="">Бүх төрөл</option>
            {(Object.keys(LEDGER_TYPE_LABELS) as LedgerType[]).map((t) => (
              <option key={t} value={t}>
                {LEDGER_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Эхлэх огноо" htmlFor="pr-from">
          <Input id="pr-from" type="date" value={filters.from ?? ""} onChange={(e) => update({ from: e.target.value || undefined })} />
        </Field>
        <Field label="Дуусах огноо" htmlFor="pr-to">
          <Input id="pr-to" type="date" value={filters.to ?? ""} onChange={(e) => update({ to: e.target.value || undefined })} />
        </Field>
      </div>

      {filters.teacherId ? (
        <BalanceCards summary={ledger.data?.summary} />
      ) : (
        <div className="mb-5">
          <BalanceCards summary={ledger.data?.summary} />
          {summary.data?.some((t) => Number(t.balance) < 0) ? (
            <p className="text-sm font-semibold text-danger">
              Сөрөг үлдэгдэлтэй багш:{" "}
              {summary.data
                .filter((t) => Number(t.balance) < 0)
                .map((t) => `${t.fullName} (${formatMoney(t.balance)})`)
                .join(", ")}
            </p>
          ) : null}
        </div>
      )}
      {teacher && !teacher.isActive ? <StatusChip tone="neutral">Идэвхгүй багш</StatusChip> : null}

      {ledger.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {ledger.data ? (
        <>
          <DataTable
            columns={ledgerColumns(!filters.teacherId)}
            rows={ledger.data.items}
            rowKey={(r) => r.id}
            empty="Цалингийн бичилт олдсонгүй."
          />
          <Pager
            page={ledger.data.page}
            limit={ledger.data.limit}
            total={ledger.data.total}
            onPage={(page) => setFilters((prev) => ({ ...prev, page }))}
          />
        </>
      ) : null}

      {paying && filters.teacherId ? (
        <PayoutModal
          teacherId={filters.teacherId}
          teacherName={teacher?.fullName ?? ""}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </>
  );
}
