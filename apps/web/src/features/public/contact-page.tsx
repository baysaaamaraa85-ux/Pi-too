import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createPlacementRequestSchema } from "@pitoo/contracts";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { api, ApiError } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Eyebrow, SectionTitle } from "@/shared/ui/eyebrow";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PACKAGES } from "./content";

type FormInput = z.input<typeof createPlacementRequestSchema>;
type FormOutput = z.output<typeof createPlacementRequestSchema>;

export function ContactPage() {
  const branches = useQuery({
    queryKey: ["public-branches"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/public/branches"),
  });

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createPlacementRequestSchema),
    defaultValues: { studentName: "", school: "", grade: "", phone: "", programInterest: "" },
  });

  const submit = useMutation({
    mutationFn: (values: FormOutput) =>
      api.post("/public/placement-requests", {
        ...values,
        branchId: values.branchId || undefined,
      }),
  });

  const errors = form.formState.errors;
  const serverError =
    submit.error instanceof ApiError ? submit.error.problem.detail : submit.error ? "Илгээхэд алдаа гарлаа." : null;

  if (submit.isSuccess) {
    return (
      <section className="px-5 pb-20 pt-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-border-warm bg-surface p-9 text-center shadow-lg">
          <CheckCircle2 className="mx-auto mb-4 size-14 text-success" />
          <h1 className="font-display text-2xl font-extrabold text-foreground-strong">
            Хүсэлт хүлээн авлаа
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Салбар тантай удахгүй холбогдож, түвшин тогтоох цагийг товлоно. Түвшин тогтоолгосны дараа
            бүртгэл хийгдэж, нэвтрэх нэр, нууц үгийг танд өгнө.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 pb-20 pt-14">
      <div className="mx-auto max-w-140">
        <Eyebrow>Холбогдох</Eyebrow>
        <SectionTitle>Суралцах эхний алхмаа хийе</SectionTitle>
        <p className="text-sm leading-[1.8] text-muted">
          Мэдээллээ үлдээгээрэй, бид хүлээн аваад удахгүй танд залгах болно.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {PACKAGES.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <p className="text-xs font-semibold text-muted">{p.name}</p>
              <p className="font-display text-lg font-extrabold text-primary">{p.price}</p>
              <p className="text-[0.7rem] text-muted">75 цагийн багц</p>
            </div>
          ))}
        </div>

        <form
          noValidate
          onSubmit={form.handleSubmit((values) => submit.mutate(values))}
          className="mt-6 grid gap-3.5 rounded-xl border-[1.5px] border-border bg-surface p-7"
        >
          <Field label="Сурагчийн нэр" htmlFor="studentName" error={errors.studentName?.message}>
            <Input id="studentName" placeholder="Сурагчийн нэр" {...form.register("studentName")} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Сургууль" htmlFor="school" error={errors.school?.message}>
              <Input id="school" placeholder="Сургуулийн нэр" {...form.register("school")} />
            </Field>
            <Field label="Анги" htmlFor="grade" error={errors.grade?.message}>
              <Input id="grade" placeholder="9-р анги" {...form.register("grade")} />
            </Field>
          </div>
          <Field label="Утасны дугаар" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" inputMode="tel" placeholder="9911 1234" {...form.register("phone")} />
          </Field>
          <Field label="Аль салбарт" htmlFor="branchId" error={errors.branchId?.message}>
            <Select id="branchId" defaultValue="" {...form.register("branchId")}>
              <option value="">Салбар сонгох (заавал биш)</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Аль хөтөлбөрт сонирхож байна вэ"
            htmlFor="programInterest"
            error={errors.programInterest?.message}
          >
            <Input
              id="programInterest"
              placeholder="Жишээ: AS & A Level"
              {...form.register("programInterest")}
            />
          </Field>
          <FormError message={serverError} />
          <Button type="submit" size="lg" disabled={submit.isPending} className="mt-1 w-full rounded-lg">
            {submit.isPending ? "Илгээж байна..." : "Илгээх"}
          </Button>
        </form>
      </div>
    </section>
  );
}
