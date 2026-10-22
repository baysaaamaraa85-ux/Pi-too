import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@pitoo/contracts";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import type { z } from "zod";
import { ApiError } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { useAuth } from "./auth-context";
import { AuthLayout } from "./auth-layout";
import { homeForRole } from "./home-for-role";

type FormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  if (status === "authenticated" && user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await login(values.identifier.trim(), values.password);
      // ФШ-03: түр нууц үгээр нэвтэрсэн бол эхлээд нууц үгээ солино.
      if (result.mustChangePassword) {
        navigate("/change-password", { replace: true });
      } else {
        navigate(from ?? homeForRole(result.role), { replace: true });
      }
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.problem.detail : "Сервертэй холбогдож чадсангүй.",
      );
    }
  });

  const errors = form.formState.errors;

  return (
    <AuthLayout
      eyebrow="Пи тоо систем"
      title="Нэвтрэх"
      subtitle="Үргэлжлүүлэхийн тулд мэдээллээ оруулна уу"
      footer={
        <>
          Бүртгэл байхгүй юу?{" "}
          <Link to="/contact" className="font-semibold text-primary hover:underline">
            Түвшин тогтоох цаг захиалах
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="grid gap-4.5">
        <Field label="Утас эсвэл и-мэйл" htmlFor="identifier" error={errors.identifier?.message}>
          <Input
            id="identifier"
            autoComplete="username"
            inputMode="email"
            placeholder="9911 1234"
            {...form.register("identifier")}
          />
        </Field>

        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2.5">
            <label htmlFor="password" className="text-sm font-semibold text-mid">
              Нууц үг
            </label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              Нууц үг мартсан?
            </Link>
          </div>
          <div className="relative flex items-center">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-11"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"}
              className="absolute right-3 flex items-center text-muted transition-colors hover:text-primary"
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
          {errors.password ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {errors.password.message}
            </p>
          ) : null}
        </div>

        <FormError message={serverError} />

        <Button type="submit" size="lg" className="w-full rounded-xl" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Нэвтэрч байна..." : "Нэвтрэх"}
        </Button>
      </form>
    </AuthLayout>
  );
}
