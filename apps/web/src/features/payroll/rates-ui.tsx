import {
  RATE_CHECK_LABELS,
  type RateCheckStatus,
  type RateProtocolDto,
  type TeacherContractRateDto,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link } from "react-router";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { StatusChip } from "@/shared/ui/status-chip";

// "40000" -> "40000.00", "40000.5" -> "40000.50". API мөнгийг яг 2 орноор шаарддаг (ФБШ-02).
export function toMoney(input: string): string {
  const [whole = "", fraction = ""] = input.replace(/[\s,]/g, "").split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export const MONEY_INPUT = /^\d+(\.\d{1,2})?$/;

export function useMyRates(enabled = true) {
  return useQuery({
    queryKey: ["my-rates"],
    enabled,
    queryFn: () => api.get<TeacherContractRateDto[]>("/payroll/my-rates"),
  });
}

// D-67: багш хүүхэд тус бүр дээрээ цагийн үнэлгээгээ оруулна. Цалин үүнээс (ах дүүгийн хөнгөлөлтөөр буурч) бодогдоно.
export function ContractRateCard({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const rates = useMyRates();
  const row = rates.data?.find((r) => r.contractId === contractId);
  const [amount, setAmount] = React.useState("");
  const [result, setResult] = React.useState<{ adjusted: number } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.put<{ adjusted: number }>(`/contracts/${contractId}/rate`, { hourlyRate: toMoney(amount) }),
    onSuccess: async (data) => {
      setResult(data);
      setAmount("");
      await queryClient.invalidateQueries({ queryKey: ["my-rates"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["ledger"] });
      await queryClient.invalidateQueries({ queryKey: ["my-students-payroll"] });
    },
  });
  if (!row) return null;
  const discount = Number(row.discountPercent);

  return (
    <div className="mt-3 rounded-xl bg-background-soft p-3.5" data-testid="contract-rate">
      <p className="text-sm font-semibold text-foreground-strong">Цагийн цалин (энэ хүүхэд заахад авах)</p>
      {row.hourlyRate ? (
        <p className="mt-0.5 text-sm text-mid" data-testid="contract-rate-current">
          Одоо: <strong>{formatMoney(row.hourlyRate)}</strong> / цаг
          {discount > 0 && row.effectiveRate ? (
            <>
              {" "}
              · Ах дүүгийн хөнгөлөлт {discount}%: цалинд <strong>{formatMoney(row.effectiveRate)}</strong> / цаг
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-0.5 text-sm font-semibold text-warning" data-testid="contract-rate-missing">
          Цагийн цалин оруулаагүй байна. Оруулах хүртэл энэ хүүхдийн цалин 0 ₮ бодогдоно.
        </p>
      )}
      <form
        className="mt-2.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          save.mutate();
        }}
      >
        <Field label="Цагийн цалин (₮ / цаг)" htmlFor={`rate-${contractId}`}>
          <Input
            id={`rate-${contractId}`}
            inputMode="decimal"
            placeholder="40000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Button type="submit" disabled={!MONEY_INPUT.test(amount.replace(/[\s,]/g, "")) || save.isPending}>
          Хадгалах
        </Button>
      </form>
      <FormError message={errorMessage(save.error)} />
      {result ? (
        <p className="mt-2 text-sm font-semibold text-success" data-testid="contract-rate-saved">
          Хадгалагдлаа.
          {result.adjusted > 0 ? ` Өмнөх ${result.adjusted} хичээлийн цалин шинэ цалингаар дахин бодогдлоо.` : ""}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        Хэзээ ч засаж болно. Засвар энэ хүүхдийн бүх хичээлийн (өмнөх ба дараах) цалинд үйлчилнэ.
      </p>
    </div>
  );
}

// ---- Захирал: цалингийн протокол ба тулгалт ----

function ProtocolRateRow({ program }: { program: RateProtocolDto["programs"][number] }) {
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState(program.protocolRate ? Number(program.protocolRate).toString() : "");
  const [saved, setSaved] = React.useState(false);
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/programs/${program.id}`, { protocolHourlyRate: value.trim() === "" ? null : toMoney(value) }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["rate-protocol"] });
    },
  });
  const valid = value.trim() === "" || MONEY_INPUT.test(value.replace(/[\s,]/g, ""));
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center" data-testid="protocol-program">
      <p className="text-sm font-semibold text-foreground-strong">{program.name}</p>
      <Input
        aria-label={`${program.name} протоколын цагийн үнэлгээ`}
        inputMode="decimal"
        placeholder="Тогтоогоогүй"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          Хадгалах
        </Button>
        {saved && !save.isPending ? <span className="text-xs font-semibold text-success">Хадгалагдлаа</span> : null}
      </div>
      {save.error ? (
        <div className="sm:col-span-3">
          <FormError message={errorMessage(save.error)} />
        </div>
      ) : null}
    </li>
  );
}

const STATUS_TONE: Record<RateCheckStatus, "success" | "danger" | "warning" | "neutral"> = {
  MATCH: "success",
  DIFFERENT: "danger",
  MISSING: "warning",
  NO_PROTOCOL: "neutral",
};

// D-67: захирал хөтөлбөр бүрт жишиг цагийн үнэлгээ (протокол) тогтоож, багшийн оруулсан үнэлгээг нүдээр тулгана.
// Протокол нь зөвхөн шалгах лавлах: цалинд нөлөөлөхгүй.
export function RateProtocolPanel() {
  const [status, setStatus] = React.useState<RateCheckStatus | "">("");
  const [teacherId, setTeacherId] = React.useState("");
  const query = useQuery({
    queryKey: ["rate-protocol"],
    queryFn: () => api.get<RateProtocolDto>("/payroll/rate-protocol"),
  });
  const rows = query.data?.rows ?? [];
  const teachers = React.useMemo(
    () => [...new Map(rows.map((r) => [r.teacherId, r.teacherName])).entries()],
    [rows],
  );
  const shown = rows.filter((r) => (!status || r.status === status) && (!teacherId || r.teacherId === teacherId));
  const counts = rows.reduce<Record<RateCheckStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { MATCH: 0, DIFFERENT: 0, MISSING: 0, NO_PROTOCOL: 0 },
  );

  return (
    <Card data-testid="rate-protocol">
      <CardHeader>
        <CardTitle>Цалингийн протокол</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted">
          Хөтөлбөр бүрийн жишиг цагийн үнэлгээг энд тогтооно. Багш хүүхэд тус бүр дээрээ үнэлгээгээ өөрөө оруулдаг, доор
          протоколтой тулгаж харна. Протокол нь цалинд нөлөөлөхгүй, зөвхөн шалгах лавлах.
        </p>
        <ul className="divide-y divide-border-warm">
          {query.data?.programs.map((p) => <ProtocolRateRow key={p.id} program={p} />)}
        </ul>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <Field label="Тулгах багш" htmlFor="proto-teacher">
            <Select id="proto-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Бүгд</option>
              {teachers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Тулгалтын төлөв" htmlFor="proto-status">
            <Select id="proto-status" value={status} onChange={(e) => setStatus(e.target.value as RateCheckStatus | "")}>
              <option value="">Бүгд</option>
              {(Object.keys(RATE_CHECK_LABELS) as RateCheckStatus[]).map((k) => (
                <option key={k} value={k}>
                  {RATE_CHECK_LABELS[k]} ({counts[k]})
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {query.isLoading ? <p className="mt-3 text-sm text-muted">Ачаалж байна...</p> : null}
        {query.data && shown.length === 0 ? <p className="mt-3 text-sm text-muted">Тохирох мөр алга.</p> : null}
        {shown.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm" data-testid="protocol-table">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-1.5">Багш</th>
                  <th>Сурагч</th>
                  <th>Хөтөлбөр</th>
                  <th className="text-right">Протокол</th>
                  <th className="text-right">Багшийн оруулсан</th>
                  <th className="text-right">Хөнгөлөлт</th>
                  <th>Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {shown.map((r) => (
                  <tr key={`${r.teacherId}-${r.contractId}`} data-testid="protocol-row" data-status={r.status}>
                    <td className="py-2">
                      <Link to={`/admin/teachers/${r.teacherId}`} className="font-semibold text-primary hover:underline">
                        {r.teacherName}
                      </Link>
                    </td>
                    <td>{r.studentName}</td>
                    <td className="text-muted">{r.programName}</td>
                    <td className="text-right tabular-nums">{r.protocolRate ? formatMoney(r.protocolRate) : "-"}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {r.enteredRate ? formatMoney(r.enteredRate) : "-"}
                    </td>
                    <td className="text-right tabular-nums">{Number(r.discountPercent) > 0 ? `${Number(r.discountPercent)}%` : "-"}</td>
                    <td>
                      <StatusChip tone={STATUS_TONE[r.status]}>{RATE_CHECK_LABELS[r.status]}</StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// D-67: ах дүүгийн хөнгөлөлт (админ). Хувиар эцэг эхийн төлөх үнэ болон энэ хүүхдийн багшийн цалин буурна.
export function DiscountForm({
  contractId,
  percent,
  listPrice,
  price,
  onChanged,
}: {
  contractId: string;
  percent: string;
  listPrice: string | null;
  price: string;
  onChanged: () => unknown;
}) {
  const [value, setValue] = React.useState(String(Number(percent)));
  const [open, setOpen] = React.useState(false);
  const save = useMutation({
    mutationFn: () => api.put(`/contracts/${contractId}/discount`, { percent: Number(value).toFixed(2) }),
    onSuccess: async () => {
      setOpen(false);
      await onChanged();
    },
  });
  const valid = /^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100;
  const current = Number(percent);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="contract-discount">
      <span className="text-mid">
        Ах дүүгийн хөнгөлөлт: <strong>{current}%</strong>
        {current > 0 && listPrice ? ` (${formatMoney(listPrice)} -> ${formatMoney(price)})` : ""}
      </span>
      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Хөнгөлөлт өөрчлөх
        </Button>
      ) : (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Хувь (%)" htmlFor={`disc-${contractId}`}>
            <Input
              id={`disc-${contractId}`}
              inputMode="decimal"
              className="w-28"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!valid || save.isPending}>
            Хадгалах
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Болих
          </Button>
        </form>
      )}
      <FormError message={errorMessage(save.error)} />
    </div>
  );
}
