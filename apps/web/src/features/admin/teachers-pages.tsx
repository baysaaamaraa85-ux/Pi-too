import { createTeacherSchema, updateTeacherSchema } from "@pitoo/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { formatMoney } from "@/shared/format/money";
import { weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";
import {
  useInvalidateDirectory,
  useTeacher,
  useTeachers,
  type Credentials,
  type TeacherRow,
} from "./directory-api";
import {
  AccountActions,
  CredentialsCard,
  FilterBar,
  USER_STATUS_OPTIONS,
  errorMessage,
  useListFilters,
} from "./list-kit";

type CreateValues = z.input<typeof createTeacherSchema>;

function CreateTeacherModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateDirectory();
  const [created, setCreated] = React.useState<Credentials | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createTeacherSchema),
    defaultValues: { fullName: "", phone: "", email: "" },
  });
  const errors = form.formState.errors;
  const create = useMutation({
    mutationFn: (values: CreateValues) =>
      api.post<{ id: string; phone: string; tempPassword: string }>("/teachers", {
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
    <Modal open={open} title="Шинэ багш нэмэх" onClose={close}>
      {created ? (
        <div className="grid gap-4">
          <CredentialsCard credentials={created} title="Багшийн данс үүслээ" />
          <Button onClick={close}>Хаах</Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="grid gap-3.5"
        >
          <Field label="Бүтэн нэр" htmlFor="t-fullName" error={errors.fullName?.message}>
            <Input id="t-fullName" {...form.register("fullName")} />
          </Field>
          <Field
            label="Утасны дугаар (нэвтрэх нэр)"
            htmlFor="t-phone"
            error={errors.phone?.message}
          >
            <Input id="t-phone" type="tel" inputMode="tel" {...form.register("phone")} />
          </Field>
          <Field
            label="Имэйл (сонголттой)"
            htmlFor="t-email"
            hint="Нууц үг сэргээх холбоос энд очно."
            error={errors.email?.message}
          >
            <Input id="t-email" type="email" {...form.register("email")} />
          </Field>
          <FormError message={errorMessage(create.error)} />
          <Button type="submit" disabled={create.isPending} className="w-fit">
            Багш үүсгэх
          </Button>
        </form>
      )}
    </Modal>
  );
}

// Шинэ шаардлага 1.2: багш нарын жагсаалт, хайлт, шүүлт, хуудаслалт, "Нэмэх".
export function AdminTeachersPage() {
  const { filters, update, setPage } = useListFilters();
  const [adding, setAdding] = React.useState(false);
  const navigate = useNavigate();
  const teachers = useTeachers(filters);

  const columns: Column<TeacherRow>[] = [
    {
      key: "name",
      header: "Нэр",
      cell: (t) => (
        <Link to={`/admin/teachers/${t.id}`} className="font-bold text-primary hover:underline">
          {t.fullName}
        </Link>
      ),
    },
    { key: "phone", header: "Утас", cell: (t) => t.phone ?? "-" },
    {
      key: "branches",
      header: "Салбар",
      cell: (t) => (t.branches.length ? t.branches.map((b) => b.name).join(", ") : "-"),
    },
    { key: "classes", header: "Анги", cell: (t) => t.activeClasses },
    {
      key: "rate",
      header: "Цагийн үнэлгээ",
      cell: (t) => (t.currentRate ? formatMoney(t.currentRate) : "Тогтоогоогүй"),
    },
    {
      key: "status",
      header: "Төлөв",
      cell: (t) => (
        <StatusChip tone={t.isActive ? "success" : "neutral"}>
          {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
        </StatusChip>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Багш нар"
        subtitle="Багшийн данс, цагийн үнэлгээ"
        action={<Button onClick={() => setAdding(true)}>Багш нэмэх</Button>}
      />
      <FilterBar filters={filters} onChange={update} statusOptions={USER_STATUS_OPTIONS} />
      {teachers.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {teachers.data ? (
        <>
          <DataTable
            columns={columns}
            rows={teachers.data.items}
            rowKey={(t) => t.id}
            onRowClick={(t) => void navigate(`/admin/teachers/${t.id}`)}
            empty="Багш олдсонгүй."
          />
          <Pager
            page={teachers.data.page}
            limit={teachers.data.limit}
            total={teachers.data.total}
            onPage={setPage}
          />
        </>
      ) : null}
      <CreateTeacherModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

type EditValues = z.input<typeof updateTeacherSchema>;

function RateForm({ teacherId }: { teacherId: string }) {
  const invalidate = useInvalidateDirectory();
  const [rate, setRate] = React.useState("");
  const [from, setFrom] = React.useState("");
  const save = useMutation({
    mutationFn: () =>
      api.post(`/teachers/${teacherId}/rates`, {
        hourlyRate: rate.includes(".") ? rate : `${rate}.00`,
        effectiveFrom: from,
      }),
    onSuccess: async () => {
      setRate("");
      setFrom("");
      await invalidate();
    },
  });
  return (
    <form
      className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Цагийн үнэлгээ (₮)" htmlFor="rate-amount">
        <Input
          id="rate-amount"
          inputMode="decimal"
          placeholder="5000"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      <Field label="Хүчинтэй болох огноо" htmlFor="rate-from">
        <Input id="rate-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </Field>
      <Button type="submit" disabled={!rate || !from || save.isPending}>
        Үнэлгээ нэмэх
      </Button>
      <div className="sm:col-span-3">
        <FormError message={errorMessage(save.error)} />
      </div>
    </form>
  );
}

export function AdminTeacherDetailPage() {
  const { id = "" } = useParams();
  const teacher = useTeacher(id);
  const invalidate = useInvalidateDirectory();
  const form = useForm<EditValues>({ resolver: zodResolver(updateTeacherSchema) });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (teacher.data) {
      form.reset({
        fullName: teacher.data.fullName,
        phone: teacher.data.phone ?? "",
        email: teacher.data.email ?? "",
      });
    }
  }, [teacher.data, form]);

  const save = useMutation({
    mutationFn: (values: EditValues) =>
      api.patch(`/teachers/${id}`, { ...values, email: values.email || null }),
    onSuccess: async () => {
      setSaved(true);
      await invalidate();
    },
  });

  if (teacher.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (!teacher.data) return <p className="text-sm text-danger">Багш олдсонгүй.</p>;
  const t = teacher.data;
  const errors = form.formState.errors;

  return (
    <>
      <PageHeader
        title={t.fullName}
        subtitle="Багшийн дэлгэрэнгүй"
        action={
          <Link to="/admin/teachers" className="text-sm font-semibold text-primary hover:underline">
            Багш нар руу буцах
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Профайл</CardTitle>
            <StatusChip tone={t.isActive ? "success" : "neutral"}>
              {t.isActive ? "Идэвхтэй" : "Идэвхгүй"}
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
                userId={t.id}
                isActive={t.isActive}
                mustChangePassword={t.mustChangePassword}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Цагийн үнэлгээ</CardTitle>
            </CardHeader>
            <CardContent>
              {t.rates.length === 0 ? (
                <p className="text-sm text-muted">Үнэлгээ тогтоогоогүй байна.</p>
              ) : (
                <ul className="divide-y divide-border-warm text-sm">
                  {t.rates.map((r) => (
                    <li key={r.id} className="flex justify-between py-2">
                      <span>{formatMoney(r.hourlyRate)} / цаг</span>
                      <span className="text-muted">{r.effectiveFrom}-аас</span>
                    </li>
                  ))}
                </ul>
              )}
              <RateForm teacherId={t.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ангиуд</CardTitle>
            </CardHeader>
            <CardContent>
              {t.classes.length === 0 ? (
                <p className="text-sm text-muted">Идэвхтэй анги байхгүй.</p>
              ) : (
                <ul className="divide-y divide-border-warm text-sm">
                  {t.classes.map((c) => (
                    <li key={c.id} className="flex justify-between py-2">
                      <span>
                        {weekdayName(c.weekday)} {c.startTime} · {c.branchName}
                      </span>
                      <span className="text-muted">
                        {c.students}/{c.capacity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
