import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { PageHeader } from "@/app/app-shell";
import { CredentialsCard, errorMessage } from "@/features/admin/list-kit";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, api } from "@/shared/api-client/client";
import type { AvailableClassDto, BranchDto, ParentDto, ProgramDto } from "@/shared/api-client/types";
import { localDateKey, weekdayName } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Stepper } from "@/shared/ui/stepper";
import { cn } from "@/shared/ui/utils";
import { formatHours } from "@/shared/format/hours";

const STEPS = ["Эцэг эх", "Сурагч", "Анги", "Баталгаажуулалт"];

interface EnrollResult {
  studentId: string;
  parentId: string;
  contractId: string;
  remainingHours: number;
  leavesLeft: number;
  tempPassword?: string;
  studentTempPassword?: string;
}

interface WizardState {
  parentPhone: string;
  parentName: string;
  studentName: string;
  school: string;
  grade: string;
  placement: string;
  withAccount: boolean;
  studentPhone: string;
  programId: string;
  classIds: string[];
  rulesAck: boolean;
  consent: boolean;
}

const EMPTY: WizardState = {
  parentPhone: "",
  parentName: "",
  studentName: "",
  school: "",
  grade: "",
  placement: "",
  withAccount: false,
  studentPhone: "",
  programId: "",
  classIds: [],
  rulesAck: false,
  consent: false,
};

const cleanPhone = (value: string) => value.replace(/[\s-]/g, "");
const todayKey = () => localDateKey(new Date());

// Шинэ шаардлага 1.4: админ (/admin/enroll) ба багш (/teacher/enroll) нэг backend
// endpoint (POST /enrollments) ашиглана. Багшид зөвхөн өөрийн ангиуд харагдана,
// өөр багшийн ангид бүртгэвэл сервер 403 буцаана (ADR-008).
export function EnrollWizardPage({ mode }: { mode: "admin" | "teacher" }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>(EMPTY);
  const [result, setResult] = React.useState<EnrollResult | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const patch = (next: Partial<WizardState>) => setState((prev) => ({ ...prev, ...next }));

  const phone = cleanPhone(state.parentPhone);
  const lookup = useQuery({
    queryKey: ["parent-lookup", phone],
    queryFn: () => api.get<ParentDto[]>(`/parents?phone=${phone}`),
    enabled: /^\d{8}$/.test(phone),
  });
  const existingParent = lookup.data?.find((p) => p.phone === phone);
  const lookedUp = lookup.isSuccess && /^\d{8}$/.test(phone);

  const programs = useQuery({
    queryKey: ["programs"],
    queryFn: () => api.get<ProgramDto[]>("/programs"),
  });
  const program = programs.data?.find((p) => p.id === state.programId);

  const submit = useMutation({
    mutationFn: (acknowledged: boolean) =>
      api.post<EnrollResult>("/enrollments", {
        parentPhone: phone,
        parentFullName: existingParent ? undefined : state.parentName.trim(),
        studentFullName: state.studentName.trim(),
        studentPhone: state.withAccount ? cleanPhone(state.studentPhone) : undefined,
        school: state.school.trim() || undefined,
        grade: state.grade.trim() || undefined,
        placementPercent: state.placement.trim() ? Number(state.placement) : undefined,
        programId: state.programId,
        classIds: state.classIds,
        fromDate: todayKey(),
        // D-82: огноо, цагийг сервер бүртгэнэ, зөвхөн баталгаажуулалт илгээнэ.
        rulesAcknowledged: true,
        consentGiven: true,
        weeklyWarningAcknowledged: acknowledged || undefined,
      }),
    onSuccess: async (created) => {
      setResult(created);
      setWarning(null);
      await Promise.all(
        ["students", "student", "parents", "parent", "contracts", "classes", "available-classes"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) => {
      // ФШ-22: хичээлийн тоо хүрээнээс гарвал анхааруулж, баталвал дахин илгээнэ.
      if (error instanceof ApiError && error.problem.type.endsWith("weekly-lessons-out-of-range")) {
        setWarning(error.problem.detail);
      }
    },
  });

  const reset = () => {
    setState(EMPTY);
    setStep(0);
    setResult(null);
    submit.reset();
  };

  const parentValid = /^\d{8}$/.test(phone) && lookedUp && (existingParent || state.parentName.trim());
  const studentValid =
    state.studentName.trim().length > 0 &&
    (!state.placement.trim() ||
      (Number(state.placement) >= 0 && Number(state.placement) <= 100)) &&
    (!state.withAccount || /^\d{8}$/.test(cleanPhone(state.studentPhone)));
  const classValid = state.programId !== "" && state.classIds.length > 0;
  const confirmValid = state.rulesAck && state.consent;

  if (result) {
    return (
      <>
        <PageHeader title="Сурагч бүртгэгдлээ" />
        <div className="mx-auto grid max-w-2xl gap-4">
          <Card>
            <CardContent className="p-6" data-testid="enroll-done">
              <p className="font-bold text-success">Бүртгэл амжилттай.</p>
              <p className="mt-1 text-sm text-mid">
                {state.studentName}: багцын үлдэгдэл {formatHours(result.remainingHours)} академик цаг, чөлөөний эрх{" "}
                {result.leavesLeft}.
              </p>
            </CardContent>
          </Card>
          {result.tempPassword ? (
            <CredentialsCard
              credentials={{ id: result.parentId, identifier: phone, tempPassword: result.tempPassword }}
              title="Эцэг эхийн данс үүслээ. Түр нууц үгийг эцэг эхэд өгнө үү."
            />
          ) : (
            <p className="text-sm text-muted">Бүртгэлтэй эцэг эхтэй холбогдлоо.</p>
          )}
          {result.studentTempPassword ? (
            <CredentialsCard
              credentials={{
                id: result.studentId,
                identifier: cleanPhone(state.studentPhone),
                tempPassword: result.studentTempPassword,
              }}
              title="Сурагчийн данс үүслээ"
            />
          ) : null}
          <Button onClick={reset} className="w-fit">
            Өөр сурагч бүртгэх
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Сурагч бүртгэх" subtitle="Эцэг эх, сурагч, багц, анги нэг дор" />
      <div className="mx-auto max-w-2xl">
        <Stepper steps={STEPS} current={step} />

        {step === 0 ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <Field label="Эцэг эхийн утас" htmlFor="w-parentPhone" hint="8 оронтой дугаар">
                <Input
                  id="w-parentPhone"
                  type="tel"
                  inputMode="tel"
                  value={state.parentPhone}
                  onChange={(e) => patch({ parentPhone: e.target.value })}
                />
              </Field>
              {existingParent ? (
                <p
                  data-testid="parent-found"
                  className="rounded-xl bg-success-bg px-3.5 py-2.5 text-sm font-semibold text-success"
                >
                  Бүртгэлтэй эцэг эх: {existingParent.fullName}. Сурагч түүнтэй холбогдоно.
                </p>
              ) : lookedUp ? (
                <Field label="Эцэг эхийн бүтэн нэр (шинэ данс үүснэ)" htmlFor="w-parentName">
                  <Input
                    id="w-parentName"
                    value={state.parentName}
                    onChange={(e) => patch({ parentName: e.target.value })}
                  />
                </Field>
              ) : null}
              <Button className="w-fit" disabled={!parentValid} onClick={() => setStep(1)}>
                Үргэлжлүүлэх
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <Field label="Сурагчийн бүтэн нэр" htmlFor="w-student">
                <Input
                  id="w-student"
                  value={state.studentName}
                  onChange={(e) => patch({ studentName: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Сургууль" htmlFor="w-school">
                  <Input
                    id="w-school"
                    value={state.school}
                    onChange={(e) => patch({ school: e.target.value })}
                  />
                </Field>
                <Field label="Анги" htmlFor="w-grade">
                  <Input
                    id="w-grade"
                    value={state.grade}
                    onChange={(e) => patch({ grade: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label="Түвшин тогтоох шалгалтын хувь (сонголттой)"
                htmlFor="w-placement"
                hint="0-100"
              >
                <Input
                  id="w-placement"
                  inputMode="decimal"
                  value={state.placement}
                  onChange={(e) => patch({ placement: e.target.value })}
                />
              </Field>
              <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-mid">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={state.withAccount}
                  onChange={(e) => patch({ withAccount: e.target.checked })}
                />
                Сурагчид нэвтрэх данс үүсгэх
              </label>
              {state.withAccount ? (
                <Field label="Сурагчийн утас (нэвтрэх нэр)" htmlFor="w-studentPhone">
                  <Input
                    id="w-studentPhone"
                    type="tel"
                    value={state.studentPhone}
                    onChange={(e) => patch({ studentPhone: e.target.value })}
                  />
                </Field>
              ) : null}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  Буцах
                </Button>
                <Button disabled={!studentValid} onClick={() => setStep(2)}>
                  Үргэлжлүүлэх
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <ClassStep
            mode={mode}
            teacherId={user?.id}
            programs={programs.data ?? []}
            programId={state.programId}
            classIds={state.classIds}
            onProgram={(programId) => patch({ programId })}
            onClasses={(classIds) => patch({ classIds })}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            valid={classValid}
          />
        ) : null}

        {step === 3 ? (
          <Card>
            <CardContent className="grid gap-4 p-6">
              <div className="rounded-xl bg-background-soft p-4 text-sm text-mid" data-testid="summary">
                <p>
                  <strong>{state.studentName}</strong> · {program?.name}
                  {program ? ` · ${formatMoney(program.currentPrice)}` : ""}
                </p>
                <p className="mt-1 text-muted">
                  Эцэг эх: {existingParent?.fullName ?? state.parentName} ({phone}) · Сонгосон анги:{" "}
                  {state.classIds.length}
                </p>
              </div>
              <label className="flex min-h-11 items-start gap-2.5 text-sm text-mid">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={state.rulesAck}
                  onChange={(e) => patch({ rulesAck: e.target.checked })}
                />
                Эцэг эх төвийн журамтай танилцсан.
              </label>
              <label className="flex min-h-11 items-start gap-2.5 text-sm text-mid">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                  checked={state.consent}
                  onChange={(e) => patch({ consent: e.target.checked })}
                />
                Эцэг эх хүүхдийн хувийн мэдээллийг боловсруулахыг зөвшөөрсөн.
              </label>
              <p className="text-xs text-muted">Танилцсан огноо, цагийг систем бүртгэх үед нь автоматаар хадгална.</p>
              <FormError message={warning ? null : errorMessage(submit.error)} />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Буцах
                </Button>
                <Button
                  disabled={!confirmValid || submit.isPending}
                  onClick={() => submit.mutate(false)}
                >
                  Бүртгэх
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <ConfirmDialog
        open={warning !== null}
        title="Анхааруулга"
        description={warning ?? ""}
        confirmLabel="Онцгой тохиолдол, хадгална"
        busy={submit.isPending}
        onConfirm={() => submit.mutate(true)}
        onClose={() => setWarning(null)}
      />
    </>
  );
}

function ClassStep({
  mode,
  teacherId,
  programs,
  programId,
  classIds,
  onProgram,
  onClasses,
  onBack,
  onNext,
  valid,
}: {
  mode: "admin" | "teacher";
  teacherId: string | undefined;
  programs: ProgramDto[];
  programId: string;
  classIds: string[];
  onProgram: (id: string) => void;
  onClasses: (ids: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  valid: boolean;
}) {
  const [branchId, setBranchId] = React.useState("");
  const [weekday, setWeekday] = React.useState("");
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<BranchDto[]>("/branches"),
  });
  const query = new URLSearchParams();
  if (mode === "teacher" && teacherId) query.set("teacherId", teacherId);
  if (branchId) query.set("branchId", branchId);
  if (weekday) query.set("weekday", weekday);
  const classes = useQuery({
    queryKey: ["available-classes", query.toString()],
    queryFn: () => api.get<AvailableClassDto[]>(`/classes/available?${query.toString()}`),
  });

  const toggle = (id: string) =>
    onClasses(classIds.includes(id) ? classIds.filter((c) => c !== id) : [...classIds, id]);

  return (
    <Card>
      <CardContent className="grid gap-4 p-6">
        <Field label="Хөтөлбөр" htmlFor="w-program">
          <Select id="w-program" value={programId} onChange={(e) => onProgram(e.target.value)}>
            <option value="">Сонгох</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.currentPrice)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            aria-label="Салбараар шүүх"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">Бүх салбар</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Гарагаар шүүх"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
          >
            <option value="">Бүх гараг</option>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {weekdayName(d)}
              </option>
            ))}
          </Select>
        </div>

        <p className="text-sm text-muted">
          {mode === "teacher" ? "Таны сул суудалтай ангиуд" : "Сул суудалтай ангиуд"} (суудал нь
          сул/нийт):
        </p>
        {classes.data?.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Сул суудалтай анги олдсонгүй.
          </p>
        ) : null}
        <ul className="grid gap-2" data-testid="class-options">
          {classes.data?.map((c) => {
            const picked = classIds.includes(c.id);
            return (
              <li key={c.id}>
                <label
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] px-4 py-2.5 transition-colors",
                    picked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={picked}
                    onChange={() => toggle(c.id)}
                    aria-label={`${c.branchName} ${weekdayName(c.weekday)} ${c.startTime}`}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <strong>
                      {weekdayName(c.weekday)} {c.startTime}
                    </strong>{" "}
                    · {c.branchName}
                    <span className="block text-muted">{c.teacherName}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {c.capacity - c.availableSeats}/{c.capacity}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack}>
            Буцах
          </Button>
          <Button disabled={!valid} onClick={onNext}>
            Үргэлжлүүлэх
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
