import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, ROLE_LABELS } from "@pitoo/contracts";
import { useMutation } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { ApiError, api } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

type FormValues = z.infer<typeof createUserSchema>;
interface Created {
  id: string;
  role: string;
  phone: string;
  tempPassword: string;
}

// ФШ-02, 03: админ багш, эцэг эхийн данс түр нууц үгтэй үүсгэнэ.
export function AdminUsersPage() {
  const [created, setCreated] = React.useState<Created | null>(null);
  const [copied, setCopied] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "TEACHER", phone: "", fullName: "" },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (values: FormValues) => api.post<Created>("/users", values),
    onSuccess: (result) => {
      setCreated(result);
      setCopied(false);
      form.reset({ role: "TEACHER", phone: "", fullName: "" });
    },
  });
  const serverError =
    create.error instanceof ApiError ? create.error.problem.detail : create.error ? "Алдаа гарлаа." : null;

  return (
    <>
      <PageHeader title="Хэрэглэгч үүсгэх" subtitle="Багш, эцэг эхийн нэвтрэх данс" />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Шинэ данс</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="grid gap-3.5"
          >
            <Field label="Үүрэг" htmlFor="role">
              <Select id="role" {...form.register("role")}>
                <option value="TEACHER">{ROLE_LABELS.TEACHER}</option>
                <option value="PARENT">{ROLE_LABELS.PARENT}</option>
              </Select>
            </Field>
            <Field label="Бүтэн нэр" htmlFor="fullName" error={errors.fullName?.message}>
              <Input id="fullName" {...form.register("fullName")} />
            </Field>
            <Field
              label="Утасны дугаар (нэвтрэх нэр)"
              htmlFor="phone"
              error={errors.phone?.message}
            >
              <Input id="phone" type="tel" inputMode="tel" {...form.register("phone")} />
            </Field>
            <FormError message={serverError} />
            <Button type="submit" disabled={create.isPending} className="w-fit">
              Данс үүсгэх
            </Button>
          </form>
        </CardContent>
      </Card>

      {created ? (
        <Card className="mt-5 max-w-xl border-success/30 bg-success-bg">
          <CardContent className="p-6">
            <p className="text-sm font-bold text-success">Данс үүслээ</p>
            <p className="mt-2 text-sm text-mid">
              Нэвтрэх нэр: <strong>{created.phone}</strong>
            </p>
            <div className="mt-2 flex items-center gap-3">
              <p className="text-sm text-mid">
                Түр нууц үг:{" "}
                <code className="rounded-md bg-white px-2 py-1 font-mono text-base font-bold text-foreground-strong">
                  {created.tempPassword}
                </code>
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(created.tempPassword);
                  setCopied(true);
                }}
              >
                <Copy className="size-3.5" /> {copied ? "Хуулсан" : "Хуулах"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Энэ нууц үг дахин харагдахгүй. Хэрэглэгчид өгнө үү, анхны нэвтрэлтээр заавал солино.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
