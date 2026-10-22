import { zodResolver } from "@hookform/resolvers/zod";
import { createStudentSchema } from "@pitoo/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { ApiError, api } from "@/shared/api-client/client";
import type {
  AvailableClassDto,
  BranchDto,
  ParentDto,
  ProgramDto,
} from "@/shared/api-client/types";
import { localDateKey, weekdayName } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Stepper } from "@/shared/ui/stepper";
import { cn } from "@/shared/ui/utils";

const STEPS = ["Анкет", "Түвшин", "Багц, анги", "Дууссан"];

type StudentForm = z.infer<typeof createStudentSchema>;

interface Registered {
  studentId: string;
  parentId: string;
  tempPassword?: string;
  studentName: string;
  parentPhone: string;
}

interface ContractDto {
  id: string;
  remainingVisits: number;
  leavesLeft: number;
  price: string;
}

function errorText(error: unknown) {
  return error instanceof ApiError ? error.problem.detail : error ? "Алдаа гарлаа." : null;
}

// Элсэлт (design 5.5.2): эцэг эх ба сурагч, түвшин, багц ба анги, баталгаажуулалт.
// Бүх бизнесийн дүрмийг (тоолуур, суудал) сервер хэрэгжүүлнэ, энд зөвхөн алхам харуулна.
export function AdminEnrollPage() {
  const [step, setStep] = React.useState(0);
  const [registered, setRegistered] = React.useState<Registered | null>(null);
  const [contract, setContract] = React.useState<ContractDto | null>(null);
  const [enrolledClassIds, setEnrolledClassIds] = React.useState<string[]>([]);

  const reset = () => {
    setStep(0);
    setRegistered(null);
    setContract(null);
    setEnrolledClassIds([]);
  };

  return (
    <>
      <PageHeader title="Шинэ сурагч бүртгэх" subtitle="Түвшин тогтоолгосны дараах бүртгэл" />
      <div className="mx-auto max-w-2xl">
        <Stepper steps={STEPS} current={step} />
        {step === 0 ? (
          <StudentStep
            onDone={(r) => {
              setRegistered(r);
              setStep(1);
            }}
          />
        ) : null}
        {step === 1 && registered ? (
          <PlacementStep studentId={registered.studentId} onDone={() => setStep(2)} />
        ) : null}
        {step === 2 && registered ? (
          <ContractStep
            studentId={registered.studentId}
            contract={contract}
            enrolledClassIds={enrolledClassIds}
            onContract={setContract}
            onEnrolled={(id) => setEnrolledClassIds((prev) => [...prev, id])}
            onDone={() => setStep(3)}
          />
        ) : null}
        {step === 3 && registered && contract ? (
          <DoneStep registered={registered} contract={contract} onReset={reset} />
        ) : null}
      </div>
    </>
  );
}

function StudentStep({ onDone }: { onDone: (r: Registered) => void }) {
  const form = useForm<StudentForm>({
    resolver: zodResolver(createStudentSchema),
    defaultValues: { parentPhone: "", parentFullName: "", studentFullName: "", school: "", grade: "" },
  });
  const errors = form.formState.errors;
  const phone = form.watch("parentPhone").replace(/[\s-]/g, "");

  // ФШ-13: ижил утастай эцэг эх бүртгэлтэй бол шинэ данс үүсгэхгүй, холбоно.
  const existing = useQuery({
    queryKey: ["parents", phone],
    enabled: phone.length >= 8,
    queryFn: () => api.get<ParentDto[]>(`/parents?phone=${phone}`),
  });
  const match = existing.data?.find((p) => p.phone === phone);

  const create = useMutation({
    mutationFn: (values: StudentForm) =>
      api.post<{ studentId: string; parentId: string; tempPassword?: string }>("/students", {
        ...values,
        parentPhone: values.parentPhone.replace(/[\s-]/g, ""),
        parentFullName: values.parentFullName || undefined,
        school: values.school || undefined,
        grade: values.grade || undefined,
      }),
    onSuccess: (result, values) =>
      onDone({
        ...result,
        studentName: values.studentFullName,
        parentPhone: values.parentPhone.replace(/[\s-]/g, ""),
      }),
  });

  return (
    <Card>
      <CardContent className="p-6">
        <form
          noValidate
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="grid gap-3.5"
        >
          <Field label="Эцэг эхийн утас" htmlFor="parentPhone" error={errors.parentPhone?.message}>
            <Input id="parentPhone" type="tel" inputMode="tel" placeholder="9911 1234" {...form.register("parentPhone")} />
          </Field>
          {match ? (
            <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-sm font-semibold text-info">
              Бүртгэлтэй эцэг эх: {match.fullName}. Шинэ данс үүсгэхгүй, холбоно.
            </p>
          ) : (
            <Field
              label="Эцэг эхийн бүтэн нэр"
              htmlFor="parentFullName"
              error={errors.parentFullName?.message}
              hint="Шинэ эцэг эхийн нэвтрэх данс үүсгэнэ."
            >
              <Input id="parentFullName" {...form.register("parentFullName")} />
            </Field>
          )}
          <Field label="Сурагчийн нэр" htmlFor="studentFullName" error={errors.studentFullName?.message}>
            <Input id="studentFullName" {...form.register("studentFullName")} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Сургууль" htmlFor="school">
              <Input id="school" {...form.register("school")} />
            </Field>
            <Field label="Анги" htmlFor="grade">
              <Input id="grade" placeholder="9-р анги" {...form.register("grade")} />
            </Field>
          </div>
          <FormError message={errorText(create.error)} />
          <Button type="submit" size="lg" disabled={create.isPending} className="mt-1">
            Үргэлжлүүлэх
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlacementStep({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [percent, setPercent] = React.useState("");
  const save = useMutation({
    mutationFn: () =>
      api.post(`/students/${studentId}/assessments`, {
        takenOn: localDateKey(new Date()),
        totalPercent: Number(percent),
      }),
    onSuccess: onDone,
  });
  const valid = percent !== "" && Number(percent) >= 0 && Number(percent) <= 100;

  return (
    <Card>
      <CardContent className="grid gap-4 p-6">
        <Field
          label="Түвшин тогтоох шалгалтын дүн (%)"
          htmlFor="percent"
          hint="Шалгалт өгсөн бол оруулна, дүнгийн түүхийн эхний цэг болно (ФШ-14)."
        >
          <Input
            id="percent"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
        </Field>
        <FormError message={errorText(save.error)} />
        <div className="flex gap-2.5">
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            Хадгалаад үргэлжлүүлэх
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Алгасах
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractStep({
  studentId,
  contract,
  enrolledClassIds,
  onContract,
  onEnrolled,
  onDone,
}: {
  studentId: string;
  contract: ContractDto | null;
  enrolledClassIds: string[];
  onContract: (c: ContractDto) => void;
  onEnrolled: (classId: string) => void;
  onDone: () => void;
}) {
  const programs = useQuery({ queryKey: ["programs"], queryFn: () => api.get<ProgramDto[]>("/programs") });
  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api.get<BranchDto[]>("/branches") });
  const classes = useQuery({
    queryKey: ["classes-available"],
    queryFn: () => api.get<AvailableClassDto[]>("/classes/available"),
  });

  const [programId, setProgramId] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [fromDate, setFromDate] = React.useState(localDateKey(new Date()));
  const [acknowledged, setAcknowledged] = React.useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      let current = contract;
      if (!current) {
        // ФШ-16: журамтай танилцсан огноо заавал (rulesAckAt).
        current = await api.post<ContractDto>("/contracts", {
          studentId,
          programId,
          rulesAckAt: new Date().toISOString(),
        });
        onContract(current);
      }
      for (const classId of selected.filter((id) => !enrolledClassIds.includes(id))) {
        await api.post(`/classes/${classId}/enrollments`, { contractId: current.id, fromDate });
        onEnrolled(classId);
      }
    },
    onSuccess: onDone,
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const ready = (contract || programId) && selected.length > 0 && acknowledged;

  return (
    <Card>
      <CardContent className="grid gap-5 p-6">
        <Field label="Багц, хөтөлбөр" htmlFor="program">
          <Select
            id="program"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            disabled={Boolean(contract)}
          >
            <option value="">Хөтөлбөр сонгох</option>
            {programs.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.currentPrice)} · 75 цаг
              </option>
            ))}
          </Select>
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-mid">Анги (сул суудалтай)</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {classes.data?.length === 0 ? (
              <p className="text-sm text-muted">Сул суудалтай анги алга байна.</p>
            ) : null}
            {classes.data?.map((cls) => {
              const on = selected.includes(cls.id) || enrolledClassIds.includes(cls.id);
              return (
                <label
                  key={cls.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] border-border bg-surface p-3.5 transition hover:border-primary",
                    on && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={on}
                    disabled={enrolledClassIds.includes(cls.id)}
                    onChange={() => toggle(cls.id)}
                  />
                  <span className="text-sm">
                    <strong className="block text-foreground-strong">
                      {weekdayName(cls.weekday)} · {cls.startTime}
                    </strong>
                    <span className="text-muted">
                      {branches.data?.find((b) => b.id === cls.branchId)?.name} · {cls.availableSeats}{" "}
                      сул суудал
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {selected.length > 0 && (selected.length < 2 || selected.length > 4) ? (
            <p className="mt-2 text-xs text-warning">
              Долоо хоногт 2-4 хичээл санал болгоно (ФШ-22), онцгой тохиолдолд үргэлжлүүлж болно.
            </p>
          ) : null}
        </fieldset>

        <Field label="Эхлэх огноо" htmlFor="fromDate">
          <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>

        <label className="flex items-start gap-3 text-sm text-mid">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          Эцэг эх сургалтын төвийн журамтай танилцсан.
        </label>

        <FormError message={errorText(submit.error)} />
        <Button size="lg" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? "Хадгалж байна..." : "Гэрээ үүсгэж, ангид бүртгэх"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DoneStep({
  registered,
  contract,
  onReset,
}: {
  registered: Registered;
  contract: ContractDto;
  onReset: () => void;
}) {
  return (
    <Card className="border-success/30">
      <CardContent className="grid gap-4 p-6">
        <h2 className="font-display text-2xl font-extrabold text-foreground-strong">
          Бүртгэл амжилттай
        </h2>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-border-warm pb-2">
            <dt className="text-muted">Сурагч</dt>
            <dd className="font-semibold">{registered.studentName}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border-warm pb-2">
            <dt className="text-muted">Багцын үлдэгдэл</dt>
            <dd className="font-semibold">{contract.remainingVisits} ирэлт</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-border-warm pb-2">
            <dt className="text-muted">Чөлөөний эрх</dt>
            <dd className="font-semibold">{contract.leavesLeft}</dd>
          </div>
          <div className="flex justify-between gap-4 pb-2">
            <dt className="text-muted">Гэрээний үнэ</dt>
            <dd className="font-semibold">{formatMoney(contract.price)}</dd>
          </div>
        </dl>
        {registered.tempPassword ? (
          <div className="rounded-xl bg-success-bg p-4 text-sm text-mid">
            Эцэг эхийн шинэ данс үүслээ. Нэвтрэх нэр: <strong>{registered.parentPhone}</strong>, түр
            нууц үг:{" "}
            <code className="rounded-md bg-white px-2 py-1 font-mono font-bold text-foreground-strong">
              {registered.tempPassword}
            </code>
            <p className="mt-2 text-xs text-muted">Энэ нууц үг дахин харагдахгүй.</p>
          </div>
        ) : (
          <p className="rounded-xl bg-info-bg p-4 text-sm font-medium text-info">
            Эцэг эх өмнө нь бүртгэлтэй тул одоо байгаа данстай нь холбогдлоо.
          </p>
        )}
        <Button onClick={onReset} className="w-fit">
          Шинэ бүртгэл хийх
        </Button>
      </CardContent>
    </Card>
  );
}
