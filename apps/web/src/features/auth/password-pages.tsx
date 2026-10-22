import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  passwordSchema,
  resetPasswordSchema,
} from "@pitoo/contracts";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { api, ApiError } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { useAuth } from "./auth-context";
import { AuthLayout } from "./auth-layout";
import { homeForRole } from "./home-for-role";

function messageOf(error: unknown) {
  return error instanceof ApiError ? error.problem.detail : "Сервертэй холбогдож чадсангүй.";
}

const changeFormSchema = changePasswordSchema
  .extend({ confirm: z.string().min(1, "Шинэ нууц үгээ давтан бичнэ үү") })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirm"],
  });

// ФШ-03: түр нууц үгээр нэвтэрсэн хэрэглэгч эхлээд нууц үгээ солино.
export function ChangePasswordPage() {
  const { user, passwordChanged } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof changeFormSchema>>({
    resolver: zodResolver(changeFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    setServerError(null);
    try {
      await api.post("/auth/password/change", { currentPassword, newPassword });
      passwordChanged();
      navigate(user ? homeForRole(user.role) : "/", { replace: true });
    } catch (error) {
      setServerError(messageOf(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Аюулгүй байдал"
      title="Нууц үг солих"
      subtitle="Шинэ нууц үг 8-аас доошгүй тэмдэгттэй байна"
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-4.5">
        <Field label="Одоогийн нууц үг" htmlFor="currentPassword" error={errors.currentPassword?.message}>
          <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
        </Field>
        <Field label="Шинэ нууц үг" htmlFor="newPassword" error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <Field label="Шинэ нууц үг (давтах)" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <FormError message={serverError} />
        <Button type="submit" size="lg" className="w-full rounded-xl" disabled={form.formState.isSubmitting}>
          Нууц үг солих
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.post("/auth/password/forgot", values);
      setSent(true);
    } catch (error) {
      setServerError(messageOf(error));
    }
  });

  return (
    <AuthLayout
      eyebrow="Пи тоо систем"
      title="Нууц үг сэргээх"
      subtitle="Бүртгэлтэй и-мэйл хаягаа оруулна уу"
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Нэвтрэх хуудас руу буцах
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-xl bg-success-bg px-4 py-3 text-sm font-medium leading-relaxed text-success">
          Хэрэв энэ и-мэйл бүртгэлтэй бол 30 минут хүчинтэй сэргээх холбоос илгээгдлээ.
        </p>
      ) : (
        <form noValidate onSubmit={onSubmit} className="grid gap-4.5">
          <Field label="И-мэйл" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          </Field>
          <FormError message={serverError} />
          <Button type="submit" size="lg" className="w-full rounded-xl" disabled={form.formState.isSubmitting}>
            Холбоос илгээх
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

const resetFormSchema = z
  .object({ newPassword: passwordSchema, confirm: z.string().min(1, "Нууц үгээ давтан бичнэ үү") })
  .refine((v) => v.newPassword === v.confirm, {
    message: "Нууц үг таарахгүй байна",
    path: ["confirm"],
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof resetFormSchema>>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { newPassword: "", confirm: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    setServerError(null);
    const parsed = resetPasswordSchema.safeParse({ token, newPassword });
    if (!parsed.success) {
      setServerError("Холбоос буруу байна.");
      return;
    }
    try {
      await api.post("/auth/password/reset", parsed.data);
      navigate("/login", { replace: true });
    } catch (error) {
      setServerError(messageOf(error));
    }
  });

  return (
    <AuthLayout eyebrow="Пи тоо систем" title="Шинэ нууц үг" subtitle="Шинэ нууц үгээ тохируулна уу">
      <form noValidate onSubmit={onSubmit} className="grid gap-4.5">
        <Field label="Шинэ нууц үг" htmlFor="newPassword" error={errors.newPassword?.message}>
          <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <Field label="Давтах" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
        <FormError message={serverError} />
        <Button type="submit" size="lg" className="w-full rounded-xl" disabled={form.formState.isSubmitting}>
          Нууц үг тохируулах
        </Button>
      </form>
    </AuthLayout>
  );
}
