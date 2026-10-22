import { zodResolver } from "@hookform/resolvers/zod";
import { createBranchSchema, createProgramSchema } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { ApiError, api } from "@/shared/api-client/client";
import type { BranchDto, ProgramDto, SettingDto } from "@/shared/api-client/types";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

function errorText(error: unknown) {
  return error instanceof ApiError ? error.problem.detail : error ? "Алдаа гарлаа." : null;
}

function Branches() {
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<BranchDto[]>("/branches") });
  const form = useForm<z.infer<typeof createBranchSchema>>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: { name: "", address: "" },
  });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof createBranchSchema>) => api.post("/branches", v),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Салбарууд</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="mb-5 divide-y divide-border-warm">
          {branches.data?.map((b) => (
            <li key={b.id} className="py-2.5">
              <p className="text-sm font-semibold text-foreground-strong">{b.name}</p>
              <p className="text-xs text-muted">{b.address}</p>
            </li>
          ))}
        </ul>
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field label="Нэр" htmlFor="b-name" error={errors.name?.message}>
            <Input id="b-name" {...form.register("name")} />
          </Field>
          <Field label="Хаяг" htmlFor="b-address" error={errors.address?.message}>
            <Input id="b-address" {...form.register("address")} />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            Нэмэх
          </Button>
          <div className="sm:col-span-3">
            <FormError message={errorText(create.error)} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProgramRow({ program }: { program: ProgramDto }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = React.useState(Number(program.currentPrice).toFixed(2));
  const save = useMutation({
    mutationFn: () => api.patch(`/programs/${program.id}`, { currentPrice: price }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["programs"] }),
  });
  const valid = /^\d+\.\d{2}$/.test(price);

  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[1fr_200px_auto] sm:items-center">
      <div>
        <p className="text-sm font-semibold text-foreground-strong">{program.name}</p>
        <p className="text-xs text-muted">Одоогийн үнэ: {formatMoney(program.currentPrice)}</p>
      </div>
      <Input
        aria-label={`${program.name} үнэ`}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        inputMode="decimal"
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={!valid || save.isPending || price === Number(program.currentPrice).toFixed(2)}
        onClick={() => save.mutate()}
      >
        Үнэ солих
      </Button>
      {save.error ? (
        <p role="alert" className="text-xs font-semibold text-danger sm:col-span-3">
          {errorText(save.error)}
        </p>
      ) : null}
    </li>
  );
}

function Programs() {
  const queryClient = useQueryClient();
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api.get<ProgramDto[]>("/programs") });
  const form = useForm<z.infer<typeof createProgramSchema>>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: { name: "", currentPrice: "" },
  });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof createProgramSchema>) => api.post("/programs", v),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
  });
  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Хөтөлбөр, багцын үнэ</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted">
          Үнэ өөрчлөгдөхөд өмнө байгуулсан гэрээний үнэ өөрчлөгдөхгүй (ФШ-08).
        </p>
        <ul className="mb-5 divide-y divide-border-warm">
          {programs.data?.map((p) => (
            <ProgramRow key={`${p.id}-${p.currentPrice}`} program={p} />
          ))}
        </ul>
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end"
        >
          <Field label="Нэр" htmlFor="p-name" error={errors.name?.message}>
            <Input id="p-name" {...form.register("name")} />
          </Field>
          <Field label="Үнэ" htmlFor="p-price" error={errors.currentPrice?.message} hint="Жишээ: 1200000.00">
            <Input id="p-price" inputMode="decimal" {...form.register("currentPrice")} />
          </Field>
          <Button type="submit" disabled={create.isPending}>
            Нэмэх
          </Button>
          <div className="sm:col-span-3">
            <FormError message={errorText(create.error)} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const SETTING_LABELS: Record<string, string> = {
  contract_defaults: "Багцын хэмжээ",
  assessment_defaults: "Давтлагын босго",
  class_defaults: "Ангийн дээд суудал",
  attendance_defaults: "Ирц засах хугацаа",
  auth_defaults: "Нэвтрэлтийн хязгаар",
  payment_account: "Төвийн дансны мэдээлэл",
};

function SettingRow({ setting }: { setting: SettingDto }) {
  const queryClient = useQueryClient();
  const initial = JSON.stringify(setting.value, null, 2);
  const [text, setText] = React.useState(initial);
  const [parseError, setParseError] = React.useState<string | null>(null);

  const save = useMutation({
    mutationFn: (value: Record<string, unknown>) =>
      api.put("/settings", { key: setting.key, value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <li className="py-3">
      <p className="text-sm font-semibold text-foreground-strong">
        {SETTING_LABELS[setting.key] ?? setting.key}{" "}
        <span className="font-mono text-xs font-normal text-muted">{setting.key}</span>
      </p>
      <textarea
        aria-label={setting.key}
        value={text}
        rows={Math.min(8, text.split("\n").length)}
        onChange={(e) => setText(e.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-background-soft p-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/10"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={text === initial || save.isPending}
          onClick={() => {
            try {
              const parsed: unknown = JSON.parse(text);
              if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                setParseError("JSON объект байх ёстой.");
                return;
              }
              setParseError(null);
              save.mutate(parsed as Record<string, unknown>);
            } catch {
              setParseError("JSON буруу байна.");
            }
          }}
        >
          Хадгалах
        </Button>
        <FormError message={parseError ?? errorText(save.error)} />
      </div>
    </li>
  );
}

// ФШ-09, ФБШ-29: журмын утгыг админ өөрөө (аудиттай) өөрчилнө.
function Settings() {
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.get<SettingDto[]>("/settings") });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Журмын утгууд</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border-warm">
          {settings.data?.map((s) => (
            <SettingRow key={`${s.key}-${JSON.stringify(s.value)}`} setting={s} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AdminCatalogPage() {
  return (
    <>
      <PageHeader title="Салбар, хөтөлбөр, журам" subtitle="Төвийн суурь мэдээлэл" />
      <div className="grid gap-5">
        <Branches />
        <Programs />
        <Settings />
      </div>
    </>
  );
}
