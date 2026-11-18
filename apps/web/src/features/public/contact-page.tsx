import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createPlacementRequestSchema } from "@pitoo/contracts";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { api, ApiError } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { PACKAGES } from "./content";
import { PageBody, PageHead, PublicPage } from "./page-kit";

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
    submit.error instanceof ApiError
      ? submit.error.problem.detail
      : submit.error
        ? "Илгээхэд алдаа гарлаа."
        : null;

  if (submit.isSuccess) {
    return (
      <PublicPage>
        <PageBody className="pt-32 sm:pt-36">
          <div className="mx-auto max-w-lg rounded-[30px] border border-ink-900/[.07] bg-white p-9 text-center shadow-[0_40px_80px_-40px_rgba(23,23,23,0.35)]">
            <CheckCircle2 className="mx-auto mb-4 size-14 text-success" aria-hidden="true" />
            <h1 className="pt-tight text-[28px] font-semibold">Хүсэлт хүлээн авлаа</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
              Салбар тантай удахгүй холбогдож, түвшин тогтоох цагийг товлоно. Түвшин тогтоолгосны
              дараа бүртгэл хийгдэж, нэвтрэх нэр, нууц үгийг танд өгнө.
            </p>
          </div>
        </PageBody>
      </PublicPage>
    );
  }

  return (
    <PublicPage>
      <PageHead
        eyebrow="Холбогдох"
        title={
          <>
            Суралцах <span className="text-brand-700">эхний алхмаа</span> хийе
          </>
        }
        text="Мэдээллээ үлдээгээрэй, бид хүлээн аваад удахгүй танд залгах болно."
      />
      <PageBody className="mt-10">
        <div className="mx-auto max-w-140">
          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map((p, i) => (
              <div
                key={p.name}
                className="rounded-[22px] border border-ink-900/[.07] px-4 py-3.5"
                style={{
                  background: `linear-gradient(180deg,${i === 0 ? "#F6E9E9" : "#F8F0E2"},#fff)`,
                }}
              >
                <p className="text-[12.5px] font-medium text-ink-500">{p.name}</p>
                <p className="pt-tight pt-num mt-0.5 text-[22px] font-semibold text-brand-700">
                  {p.price}
                </p>
                <p className="text-[12px] text-ink-500">75 цагийн багц</p>
              </div>
            ))}
          </div>

          <form
            noValidate
            onSubmit={form.handleSubmit((values) => submit.mutate(values))}
            className="mt-5 grid gap-3.5 rounded-[30px] border border-ink-900/[.07] bg-white p-6 shadow-[0_40px_80px_-40px_rgba(23,23,23,0.3)] sm:p-8"
          >
            <Field label="Сурагчийн нэр" htmlFor="studentName" error={errors.studentName?.message}>
              <Input
                id="studentName"
                placeholder="Сурагчийн нэр"
                {...form.register("studentName")}
              />
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
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="9911 1234"
                {...form.register("phone")}
              />
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
            <Button
              type="submit"
              size="lg"
              disabled={submit.isPending}
              className="mt-1 h-12 w-full rounded-full bg-brand-700 hover:bg-brand-800"
            >
              {submit.isPending ? "Илгээж байна..." : "Илгээх"}
            </Button>
          </form>
        </div>
      </PageBody>
    </PublicPage>
  );
}
