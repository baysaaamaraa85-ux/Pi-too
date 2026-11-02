import type { AuditEntryDto, Paginated } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { formatDateTime } from "@/shared/format/date";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value);
}

// Аудитын бүртгэл: зөвхөн уншина (ФБШ-24). Хэн, хэзээ, юуг, ямар шалтгаанаар өөрчилсөн.
export function AdminAuditPage() {
  const [entity, setEntity] = React.useState("");
  const [action, setAction] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (entity.trim()) params.set("entity", entity.trim());
  if (action.trim()) params.set("action", action.trim());
  if (actor.trim()) params.set("actor", actor.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const audit = useQuery({
    queryKey: ["audit", params.toString()],
    queryFn: () => api.get<Paginated<AuditEntryDto>>(`/audit-log?${params.toString()}`),
  });
  const reset = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setPage(1);
  };

  const columns: Column<AuditEntryDto>[] = [
    { key: "time", header: "Огноо", cell: (r) => formatDateTime(r.createdAt) },
    { key: "actor", header: "Хэн", cell: (r) => r.actor },
    { key: "entity", header: "Объект", cell: (r) => r.entity },
    { key: "action", header: "Үйлдэл", cell: (r) => <strong>{r.action}</strong> },
    { key: "reason", header: "Шалтгаан", cell: (r) => r.reason ?? "-" },
    {
      key: "diff",
      header: "Өөрчлөлт",
      className: "max-w-[28rem]",
      cell: (r) => (
        <details>
          <summary className="cursor-pointer text-primary">Харах</summary>
          <p className="mt-1 break-words text-xs text-muted">Өмнө: {jsonText(r.before)}</p>
          <p className="break-words text-xs text-muted">Дараа: {jsonText(r.after)}</p>
          <p className="break-all text-xs text-muted">ID: {r.entityId}</p>
        </details>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Аудит" subtitle="Өөрчлөлтийн бүртгэл (зөвхөн унших)" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Объект (entity)" htmlFor="audit-entity">
          <Input id="audit-entity" value={entity} onChange={reset(setEntity)} placeholder="contract" />
        </Field>
        <Field label="Үйлдэл" htmlFor="audit-action">
          <Input id="audit-action" value={action} onChange={reset(setAction)} placeholder="TRANSFER" />
        </Field>
        <Field label="Хийсэн хүний утас, имэйл" htmlFor="audit-actor">
          <Input id="audit-actor" value={actor} onChange={reset(setActor)} />
        </Field>
        <Field label="Эхлэх огноо" htmlFor="audit-from">
          <Input id="audit-from" type="date" value={from} onChange={reset(setFrom)} />
        </Field>
        <Field label="Дуусах огноо" htmlFor="audit-to">
          <Input id="audit-to" type="date" value={to} onChange={reset(setTo)} />
        </Field>
      </div>
      {audit.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {audit.data ? (
        <>
          <DataTable columns={columns} rows={audit.data.items} rowKey={(r) => r.id} empty="Бүртгэл олдсонгүй." />
          <Pager page={audit.data.page} limit={audit.data.limit} total={audit.data.total} onPage={setPage} />
        </>
      ) : null}
    </>
  );
}
