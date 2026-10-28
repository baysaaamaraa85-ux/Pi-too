import { CONTRACT_STATUS_LABELS, createParentSchema, updateParentSchema } from "@pitoo/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import {
  useInvalidateDirectory,
  useParent,
  useParents,
  type Credentials,
  type ParentRow,
} from "./directory-api";
import {
  AccountActions,
  CredentialsCard,
  FilterBar,
  USER_STATUS_OPTIONS,
  errorMessage,
  useListFilters,
} from "./list-kit";

type CreateValues = z.input<typeof createParentSchema>;

function CreateParentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateDirectory();
  const [created, setCreated] = React.useState<Credentials | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createParentSchema),
    defaultValues: { fullName: "", phone: "", email: "" },
  });
  const errors = form.formState.errors;
  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      api.post<{ id: string; phone: string; tempPassword: string }>("/parents", {
        ...values,
        email: values.email || undefined,
      }),
    onSuccess: async (result) => {
      setCreated({ id: result.id, identifier: result.phone, tempPassword: result.tempPassword });
      form.reset();
      await invalidate();
    },
  });
  const close = () => {
    setCreated(null);
    create.reset();
    onClose();
  };

  return (
    <Modal open={open} title="Шинэ эцэг эх нэмэх" onClose={close}>
      {created ? (
        <div className="grid gap-4">
          <CredentialsCard credentials={created} title="Эцэг эхийн данс үүслээ" />
          <Button onClick={close}>Хаах</Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="grid gap-3.5"
        >
          <Field label="Бүтэн нэр" htmlFor="p-fullName" error={errors.fullName?.message}>
            <Input id="p-fullName" {...form.register("fullName")} />
          </Field>
          <Field label="Утасны дугаар (нэвтрэх нэр)" htmlFor="p-phone" error={errors.phone?.message}>
            <Input id="p-phone" type="tel" inputMode="tel" {...form.register("phone")} />
          </Field>
          <Field label="Имэйл (сонголттой)" htmlFor="p-email" error={errors.email?.message}>
            <Input id="p-email" type="email" {...form.register("email")} />
          </Field>
          <FormError message={errorMessage(create.error)} />
          <Button type="submit" disabled={create.isPending} className="w-fit">
            Эцэг эх үүсгэх
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function AdminParentsPage() {
  const { filters, update, setPage } = useListFilters();
  const [adding, setAdding] = React.useState(false);
  const navigate = useNavigate();
  const parents = useParents(filters);

  const columns: Column<ParentRow>[] = [
    {
      key: "name",
      header: "Нэр",
      cell: (p) => (
        <Link to={`/admin/parents/${p.id}`} className="font-bold text-primary hover:underline">
          {p.fullName}
        </Link>
      ),
    },
    { key: "phone", header: "Утас", cell: (p) => p.phone },
    {
      key: "children",
      header: "Хүүхдүүд",
      cell: (p) => (p.children.length ? p.children.map((c) => c.fullName).join(", ") : "-"),
    },
    {
      key: "status",
      header: "Төлөв",
      cell: (p) => (
        <StatusChip tone={p.isActive ? "success" : "neutral"}>
          {p.isActive ? "Идэвхтэй" : "Идэвхгүй"}
        </StatusChip>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Эцэг эхчүүд"
        subtitle="Эцэг эхийн данс, хүүхдүүд"
        action={<Button onClick={() => setAdding(true)}>Эцэг эх нэмэх</Button>}
      />
      <FilterBar
        filters={filters}
        onChange={update}
        statusOptions={USER_STATUS_OPTIONS}
        searchLabel="Нэр, утас, хүүхдийн нэрээр хайх"
      />
      {parents.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {parents.data ? (
        <>
          <DataTable
            columns={columns}
            rows={parents.data.items}
            rowKey={(p) => p.id}
            onRowClick={(p) => void navigate(`/admin/parents/${p.id}`)}
            empty="Эцэг эх олдсонгүй."
          />
          <Pager
            page={parents.data.page}
            limit={parents.data.limit}
            total={parents.data.total}
            onPage={setPage}
          />
        </>
      ) : null}
      <CreateParentModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

type EditValues = z.input<typeof updateParentSchema>;

export function AdminParentDetailPage() {
  const { id = "" } = useParams();
  const parent = useParent(id);
  const invalidate = useInvalidateDirectory();
  const form = useForm<EditValues>({ resolver: zodResolver(updateParentSchema) });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (parent.data) {
      form.reset({
        fullName: parent.data.fullName,
        phone: parent.data.phone,
        email: parent.data.email ?? "",
      });
    }
  }, [parent.data, form]);

  const save = useMutation({
    mutationFn: (values: EditValues) =>
      api.patch(`/parents/${id}`, { ...values, email: values.email || null }),
    onSuccess: async () => {
      setSaved(true);
      await invalidate();
    },
  });

  if (parent.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (!parent.data) return <p className="text-sm text-danger">Эцэг эх олдсонгүй.</p>;
  const p = parent.data;
  const errors = form.formState.errors;

  return (
    <>
      <PageHeader
        title={p.fullName}
        subtitle="Эцэг эхийн дэлгэрэнгүй"
        action={
          <Link to="/admin/parents" className="text-sm font-semibold text-primary hover:underline">
            Эцэг эхчүүд рүү буцах
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Профайл</CardTitle>
            <StatusChip tone={p.isActive ? "success" : "neutral"}>
              {p.isActive ? "Идэвхтэй" : "Идэвхгүй"}
            </StatusChip>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={form.handleSubmit((values) => {
                setSaved(false);
                save.mutate(values);
              })}
              className="grid gap-3.5"
            >
              <Field label="Бүтэн нэр" htmlFor="e-fullName" error={errors.fullName?.message}>
                <Input id="e-fullName" {...form.register("fullName")} />
              </Field>
              <Field label="Утас" htmlFor="e-phone" error={errors.phone?.message}>
                <Input id="e-phone" type="tel" {...form.register("phone")} />
              </Field>
              <Field label="Имэйл" htmlFor="e-email" error={errors.email?.message}>
                <Input id="e-email" type="email" {...form.register("email")} />
              </Field>
              <FormError message={errorMessage(save.error)} />
              {saved ? <p className="text-sm font-semibold text-success">Хадгалагдлаа.</p> : null}
              <Button type="submit" disabled={save.isPending} className="w-fit">
                Хадгалах
              </Button>
            </form>
            <div className="mt-6 border-t border-border-warm pt-5">
              <AccountActions
                userId={p.id}
                isActive={p.isActive}
                mustChangePassword={p.mustChangePassword}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Хүүхдүүд</CardTitle>
          </CardHeader>
          <CardContent>
            {p.children.length === 0 ? (
              <p className="text-sm text-muted">Холбогдсон хүүхэд байхгүй.</p>
            ) : (
              <ul className="grid gap-4">
                {p.children.map((child) => (
                  <li key={child.id} className="rounded-xl border border-border-warm p-4">
                    <Link
                      to={`/admin/students/${child.id}`}
                      className="font-bold text-primary hover:underline"
                    >
                      {child.fullName}
                    </Link>
                    <p className="text-xs text-muted">
                      {[child.grade, child.school].filter(Boolean).join(" · ") || "Мэдээлэл дутуу"}
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm text-mid">
                      {child.contracts.length === 0 ? (
                        <li className="text-muted">Гэрээгүй</li>
                      ) : (
                        child.contracts.map((c) => (
                          <li key={c.id}>
                            {c.programName}: {c.remainingVisits}/{c.totalVisits} ирэлт ·{" "}
                            {CONTRACT_STATUS_LABELS[c.status]}
                          </li>
                        ))
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
