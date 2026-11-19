import type { SetContractRatesResultDto, StudentPayrollRowDto } from "@pitoo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { MONEY_INPUT, toMoney } from "./rates-ui";

// D-99: багш бүх идэвхтэй хүүхдийнхээ цагийн цалинг нэг цонхонд оруулж, нэг дор хадгална.
// Хадгалсны дараа хүүхэд бүрийн цалин өөрийнх нь цагийн цалингаар (өмнөх, дараах хичээл дээр) дахин бодогдоно.

const cleaned = (value: string) => value.replace(/[\s,]/g, "");

export function BulkRatesModal({
  rows,
  onClose,
  onSaved,
}: {
  rows: StudentPayrollRowDto[];
  onClose: () => void;
  onSaved: (result: SetContractRatesResultDto) => void;
}) {
  const queryClient = useQueryClient();
  // Нээгдэх үед одоогийн цалингаар бөглөнө. Цонх нээлттэй байхад жагсаалт дахин татагдсан ч бичсэн утга алдагдахгүй.
  const [draft, setDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.contractId, r.hourlyRate ? String(Number(r.hourlyRate)) : ""])),
  );

  // Хоосон биш, буруу хэлбэртэй мөрүүд (хадгалахыг хаана).
  const invalid = rows.filter((r) => {
    const v = cleaned(draft[r.contractId] ?? "");
    return v !== "" && !MONEY_INPUT.test(v);
  });
  // Өмнөхөөсөө өөр утгатай мөрүүд л илгээгдэнэ.
  const changed = rows.flatMap((r) => {
    const v = cleaned(draft[r.contractId] ?? "");
    if (v === "" || !MONEY_INPUT.test(v)) return [];
    const hourlyRate = toMoney(v);
    return hourlyRate === r.hourlyRate ? [] : [{ contractId: r.contractId, hourlyRate }];
  });

  const save = useMutation({
    mutationFn: () => api.put<SetContractRatesResultDto>("/payroll/my-rates", { rates: changed }),
    onSuccess: async (result) => {
      await Promise.all(
        ["my-rates", "my-students-payroll", "ledger", "dashboard"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onSaved(result);
      onClose();
    },
  });

  return (
    <Modal
      open
      title="Хүүхдүүдийн цагийн цалин"
      description="Хүүхэд бүрийн 1 цагийн цалинг оруулаад нэг дор хадгална. Хоосон үлдээсэн хүүхдийн цалин өөрчлөгдөхгүй."
      onClose={onClose}
    >
      <ul className="grid max-h-[50vh] divide-y divide-border-warm overflow-y-auto" data-testid="bulk-rate-list">
        {rows.map((r) => {
          const bad = invalid.some((x) => x.contractId === r.contractId);
          const discount = Number(r.discountPercent);
          return (
            <li key={r.contractId} className="flex items-center justify-between gap-3 py-2.5" data-testid="bulk-rate-row">
              <label htmlFor={`bulk-${r.contractId}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground-strong">{r.studentName}</span>
                <span className="block truncate text-xs text-muted">
                  {r.programName}
                  {discount > 0 ? ` · хөнгөлөлт ${discount}%` : ""}
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-1.5">
                <Input
                  id={`bulk-${r.contractId}`}
                  inputMode="decimal"
                  placeholder="40000"
                  aria-label={`${r.studentName}: цагийн цалин`}
                  aria-invalid={bad}
                  value={draft[r.contractId] ?? ""}
                  onChange={(e) => setDraft({ ...draft, [r.contractId]: e.target.value })}
                  className={bad ? "w-32 border-danger text-right" : "w-32 text-right"}
                />
                <span className="text-sm text-muted" aria-hidden="true">
                  ₮
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Оруулсан цалин тухайн хүүхдийн бүх хичээлийн (өмнөх ба дараах) цалинд үйлчилнэ. Хэзээ ч дахин засаж болно.
      </p>
      {invalid.length > 0 ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          Цалинг зөвхөн тоогоор бичнэ үү (жишээ нь 40000).
        </p>
      ) : null}
      <FormError message={errorMessage(save.error)} />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted" data-testid="bulk-rate-count">
          {changed.length > 0 ? `${changed.length} хүүхдийн цалин өөрчлөгдөнө` : "Өөрчлөлт алга"}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={save.isPending}>
            Болих
          </Button>
          <Button
            type="button"
            data-testid="bulk-rate-save"
            disabled={changed.length === 0 || invalid.length > 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Хадгалж байна..." : "Хадгалаад буцах"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
