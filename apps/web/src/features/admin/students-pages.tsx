import {
  ATTENDANCE_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  updateStudentSchema,
  type AttendanceStatus,
} from "@pitoo/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import type { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import type { ParentDto } from "@/shared/api-client/types";
import { formatDate, formatDateTime, weekdayName } from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { DataTable, Pager, type Column } from "@/shared/ui/data-table";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { AttendanceStatusChip, StatusChip } from "@/shared/ui/status-chip";
import {
  useInvalidateDirectory,
  useStudent,
  useStudents,
  type ContractSummary,
  type Credentials,
  type StudentRow,
} from "./directory-api";
import {
  AccountActions,
  CredentialsCard,
  FilterBar,
  errorMessage,
  useListFilters,
} from "./list-kit";

const STUDENT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Идэвхтэй багц" },
  { value: "PAUSED", label: "Түр зогссон" },
  { value: "COMPLETED", label: "Багц дууссан" },
  { value: "NONE", label: "Гэрээгүй" },
];

function classText(c: ContractSummary["classes"][number]) {
  return `${c.branchName}, ${weekdayName(c.weekday)} ${c.startTime}, ${c.teacherName}`;
}

interface CreatedStudent {
  studentId: string;
  parentId: string;
  tempPassword?: string;
  studentTempPassword?: string;
}

// ФШ-12, 13: сурагч үүсгэхэд эцэг эх заавал холбогдоно. Утсаар олдвол холбоно,
// олдохгүй бол эцэг эхийн данс хамт үүснэ.
function CreateStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateDirectory();
  const [parentPhone, setParentPhone] = React.useState("");
  const [parentName, setParentName] = React.useState("");
  const [studentName, setStudentName] = React.useState("");
  const [school, setSchool] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [withAccount, setWithAccount] = React.useState(false);
  const [studentPhone, setStudentPhone] = React.useState("");
  const [result, setResult] = React.useState<{
    parent?: Credentials;
    student?: Credentials;
  } | null>(null);

  const normalizedPhone = parentPhone.replace(/[\s-]/g, "");
  const lookup = useQuery({
    queryKey: ["parent-lookup", normalizedPhone],
    queryFn: () => api.get<ParentDto[]>(`/parents?phone=${normalizedPhone}`),
    enabled: open && normalizedPhone.length === 8,
  });
  const existing = lookup.data?.find((p) => p.phone === normalizedPhone);
  const lookedUp = lookup.isSuccess && normalizedPhone.length === 8;

  const create = useMutation({
    mutationFn: () =>
      api.post<CreatedStudent>("/students", {
        parentPhone: normalizedPhone,
        parentFullName: existing ? undefined : parentName.trim(),
        studentFullName: studentName.trim(),
        school: school.trim() || undefined,
        grade: grade.trim() || undefined,
        studentPhone: withAccount ? studentPhone.replace(/[\s-]/g, "") : undefined,
      }),
    onSuccess: async (created) => {
      setResult({
        parent: created.tempPassword
          ? { id: created.parentId, identifier: normalizedPhone, tempPassword: created.tempPassword }
          : undefined,
        student: created.studentTempPassword
          ? {
              id: created.studentId,
              identifier: studentPhone.replace(/[\s-]/g, ""),
              tempPassword: created.studentTempPassword,
            }
          : undefined,
      });
      await invalidate();
    },
  });

  const reset = () => {
    setParentPhone("");
    setParentName("");
    setStudentName("");
    setSchool("");
    setGrade("");
    setWithAccount(false);
    setStudentPhone("");
    setResult(null);
    create.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const valid =
    /^\d{8}$/.test(normalizedPhone) &&
    lookedUp &&
    studentName.trim().length > 0 &&
    (existing || parentName.trim().length > 0) &&
    (!withAccount || /^\d{8}$/.test(studentPhone.replace(/[\s-]/g, "")));

  return (
    <Modal open={open} title="Шинэ сурагч нэмэх" onClose={close}>
      {result ? (
        <div className="grid gap-4">
          <p className="text-sm font-semibold text-success">Сурагч бүртгэгдлээ.</p>
          {result.parent ? (
            <CredentialsCard credentials={result.parent} title="Эцэг эхийн данс үүслээ" />
          ) : (
            <p className="text-sm text-muted">Бүртгэлтэй эцэг эхтэй холбогдлоо.</p>
          )}
          {result.student ? (
            <CredentialsCard credentials={result.student} title="Сурагчийн данс үүслээ" />
          ) : null}
          <Button onClick={close}>Хаах</Button>
        </div>
      ) : (
        <form
          noValidate
          className="grid gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Эцэг эхийн утас" htmlFor="s-parentPhone" hint="8 оронтой дугаар">
            <Input
              id="s-parentPhone"
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
            />
          </Field>
          {existing ? (
            <p
              data-testid="parent-found"
              className="rounded-xl bg-success-bg px-3.5 py-2.5 text-sm font-semibold text-success"
            >
              Бүртгэлтэй эцэг эх: {existing.fullName}. Сурагч түүнтэй холбогдоно.
            </p>
          ) : lookedUp ? (
            <Field label="Эцэг эхийн бүтэн нэр (шинэ данс)" htmlFor="s-parentName">
              <Input
                id="s-parentName"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Сурагчийн бүтэн нэр" htmlFor="s-name">
            <Input id="s-name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </Field>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Сургууль" htmlFor="s-school">
              <Input id="s-school" value={school} onChange={(e) => setSchool(e.target.value)} />
            </Field>
            <Field label="Анги" htmlFor="s-grade">
              <Input id="s-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-mid">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={withAccount}
              onChange={(e) => setWithAccount(e.target.checked)}
            />
            Сурагчид данс үүсгэх
          </label>
          {withAccount ? (
            <Field label="Сурагчийн утас (нэвтрэх нэр)" htmlFor="s-phone">
              <Input
                id="s-phone"
                type="tel"
                inputMode="tel"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
              />
            </Field>
          ) : null}
          <FormError message={errorMessage(create.error)} />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!valid || create.isPending}>
              Сурагч үүсгэх
            </Button>
            <Link to="/admin/enroll" className="text-sm font-semibold text-primary hover:underline">
              Гэрээ, ангитай нь бүртгэх
            </Link>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function AdminStudentsPage() {
  const { filters, update, setPage } = useListFilters();
  const [adding, setAdding] = React.useState(false);
  const navigate = useNavigate();
  const students = useStudents(filters);

  const columns: Column<StudentRow>[] = [
    {
      key: "name",
      header: "Сурагч",
      cell: (s) => (
        <Link to={`/admin/students/${s.id}`} className="font-bold text-primary hover:underline">
          {s.fullName}
        </Link>
      ),
    },
    {
      key: "program",
      header: "Хөтөлбөр",
      cell: (s) => s.contract?.programName ?? "Гэрээгүй",
    },
    {
      key: "class",
      header: "Анги",
      cell: (s) =>
        s.contract && s.contract.classes.length > 0 ? (
          <ul className="grid gap-0.5">
            {s.contract.classes.map((c) => (
              <li key={c.id}>{classText(c)}</li>
            ))}
          </ul>
        ) : (
          "-"
        ),
    },
    {
      key: "package",
      header: "Багц",
      cell: (s) =>
        s.contract ? (
          <span data-testid="package-balance">
            {s.contract.remainingVisits}/{s.contract.totalVisits}
          </span>
        ) : (
          "-"
        ),
    },
    { key: "leaves", header: "Чөлөө", cell: (s) => s.contract?.leavesLeft ?? "-" },
    {
      key: "status",
      header: "Төлөв",
      cell: (s) =>
        s.contract ? (
          <StatusChip tone={s.contract.status === "ACTIVE" ? "success" : "neutral"}>
            {CONTRACT_STATUS_LABELS[s.contract.status]}
          </StatusChip>
        ) : (
          <StatusChip tone="neutral">Гэрээгүй</StatusChip>
        ),
    },
    {
      key: "parent",
      header: "Эцэг эх",
      cell: (s) => s.parents.map((p) => p.fullName).join(", ") || "-",
    },
  ];

  return (
    <>
      <PageHeader
        title="Сурагчид"
        subtitle="Сурагч, багц, анги"
        action={<Button onClick={() => setAdding(true)}>Сурагч нэмэх</Button>}
      />
      <FilterBar
        filters={filters}
        onChange={update}
        statusOptions={STUDENT_STATUS_OPTIONS}
        searchLabel="Нэр, эцэг эхийн утасаар хайх"
      />
      {students.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      {students.data ? (
        <>
          <DataTable
            columns={columns}
            rows={students.data.items}
            rowKey={(s) => s.id}
            onRowClick={(s) => void navigate(`/admin/students/${s.id}`)}
            empty="Сурагч олдсонгүй."
          />
          <Pager
            page={students.data.page}
            limit={students.data.limit}
            total={students.data.total}
            onPage={setPage}
          />
        </>
      ) : null}
      <CreateStudentModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

type EditValues = z.input<typeof updateStudentSchema>;

export function AdminStudentDetailPage() {
  const { id = "" } = useParams();
  const student = useStudent(id);
  const invalidate = useInvalidateDirectory();
  const form = useForm<EditValues>({ resolver: zodResolver(updateStudentSchema) });
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (student.data) {
      form.reset({
        fullName: student.data.fullName,
        school: student.data.school ?? "",
        grade: student.data.grade ?? "",
      });
    }
  }, [student.data, form]);

  const save = useMutation({
    mutationFn: (values: EditValues) =>
      api.patch(`/students/${id}`, {
        fullName: values.fullName,
        school: values.school || null,
        grade: values.grade || null,
      }),
    onSuccess: async () => {
      setSaved(true);
      await invalidate();
    },
  });

  if (student.isLoading) return <p className="text-sm text-muted">Ачаалж байна...</p>;
  if (!student.data) return <p className="text-sm text-danger">Сурагч олдсонгүй.</p>;
  const s = student.data;
  const errors = form.formState.errors;

  return (
    <>
      <PageHeader
        title={s.fullName}
        subtitle="Сурагчийн дэлгэрэнгүй"
        action={
          <Link to="/admin/students" className="text-sm font-semibold text-primary hover:underline">
            Сурагчид руу буцах
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Профайл</CardTitle>
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
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Сургууль" htmlFor="e-school">
                    <Input id="e-school" {...form.register("school")} />
                  </Field>
                  <Field label="Анги" htmlFor="e-grade">
                    <Input id="e-grade" {...form.register("grade")} />
                  </Field>
                </div>
                <FormError message={errorMessage(save.error)} />
                {saved ? <p className="text-sm font-semibold text-success">Хадгалагдлаа.</p> : null}
                <Button type="submit" disabled={save.isPending} className="w-fit">
                  Хадгалах
                </Button>
              </form>
              <p className="mt-4 text-xs text-muted">
                Хувийн мэдээллийн зөвшөөрөл:{" "}
                {s.consentAt ? formatDate(s.consentAt) : "бүртгээгүй"}
              </p>
              {s.accountId ? (
                <div className="mt-5 border-t border-border-warm pt-5">
                  <p className="mb-3 text-sm text-mid">
                    Сурагчийн данс: <strong>{s.accountPhone}</strong>
                  </p>
                  <AccountActions
                    userId={s.accountId}
                    isActive={s.accountActive ?? true}
                    mustChangePassword={false}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Эцэг эх</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border-warm text-sm">
                {s.parents.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <Link to={`/admin/parents/${p.id}`} className="font-semibold text-primary">
                      {p.fullName}
                    </Link>
                    <span className="text-muted">{p.phone}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Гэрээ, анги</CardTitle>
            </CardHeader>
            <CardContent>
              {s.contracts.length === 0 ? (
                <p className="text-sm text-muted">Гэрээ байхгүй.</p>
              ) : (
                <ul className="grid gap-3">
                  {s.contracts.map((c) => (
                    <li key={c.id} className="rounded-xl border border-border-warm p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{c.programName}</strong>
                        <StatusChip tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </StatusChip>
                      </div>
                      <p className="mt-1 text-mid">
                        Багц {c.remainingVisits}/{c.totalVisits} · Чөлөө {c.leavesLeft} · Үнэ{" "}
                        {formatMoney(c.price)}
                      </p>
                      {c.classes.map((cls) => (
                        <p key={cls.id} className="text-muted">
                          {classText(cls)}
                        </p>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Сорил, шалгалт</CardTitle>
            </CardHeader>
            <CardContent>
              {s.assessments.length === 0 ? (
                <p className="text-sm text-muted">Дүн бүртгэгдээгүй.</p>
              ) : (
                <ul className="divide-y divide-border-warm text-sm">
                  {s.assessments.map((a) => (
                    <li key={a.id} className="flex justify-between py-2">
                      <span>{formatDate(a.takenOn)}</span>
                      <span className="font-semibold">{Number(a.totalPercent)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ирцийн түүх</CardTitle>
            </CardHeader>
            <CardContent>
              {s.attendance.length === 0 ? (
                <p className="text-sm text-muted">Ирц бүртгэгдээгүй.</p>
              ) : (
                <ul className="divide-y divide-border-warm text-sm">
                  {s.attendance.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {formatDateTime(a.startsAt)} · {a.branchName}
                      </span>
                      <AttendanceStatusChip
                        status={a.status}
                        label={ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus]}
                      />
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
