import { ATTENDANCE_STATUS_LABELS } from "@pitoo/contracts";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, ClipboardCheck, Wallet } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { DayGroups, LessonCard, useLessons } from "@/features/schedule/lessons";
import type { LessonDto } from "@/shared/api-client/types";
import {
  addDaysToKey,
  formatDate,
  formatTime,
  localDateKey,
  weekdayName,
  weekdayOf,
} from "@/shared/format/date";
import { formatMoney } from "@/shared/format/money";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { AttendanceStatusChip } from "@/shared/ui/status-chip";
import {
  contractByClassId,
  useAttendanceOverview,
  usePaymentInstructions,
  usePortalSummary,
  type PortalStudent,
} from "./portal-api";
import {
  ChildPicker,
  ContractSummary,
  EmptyNote,
  LeaveRequestAction,
  PortalLoading,
  useSelectedChild,
} from "./portal-parts";

function useRange(daysAhead: number) {
  const today = localDateKey(new Date());
  return { from: addDaysToKey(today, -1), to: addDaysToKey(today, daysAhead), today };
}

function classIdsOf(student: PortalStudent | undefined) {
  return new Set((student?.contracts ?? []).flatMap((c) => c.classes.map((cls) => cls.id)));
}

// Сурагчийн дараагийн товлогдсон хичээл (ирээдүйн, цуцлагдаагүй).
function nextLessonOf(lessons: LessonDto[] | undefined, student: PortalStudent) {
  const classIds = classIdsOf(student);
  const now = Date.now();
  return lessons?.find(
    (l) => classIds.has(l.classId) && l.status === "SCHEDULED" && new Date(l.startsAt).getTime() > now,
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: string;
  icon: typeof CalendarDays;
  title: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-border-warm bg-surface p-4 shadow-sm transition-colors hover:border-primary"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/16 text-primary">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block font-bold text-foreground-strong">{title}</span>
        <span className="block text-[0.82rem] text-muted">{text}</span>
      </span>
    </Link>
  );
}

// Сурагч: "Миний самбар". Эцэг эх: "Таны хүүхдүүд". Төлбөрийн мэдээлэл зөвхөн эцэг эхэд.
export function PortalHomePage() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const summary = usePortalSummary();
  const { from, to } = useRange(29);
  const lessons = useLessons(from, to);
  const students = summary.data?.students ?? [];

  return (
    <>
      <PageHeader
        title={isParent ? "Таны хүүхдүүд" : "Миний самбар"}
        subtitle={isParent ? "Хүүхэд бүрийн багц, чөлөөний үлдэгдэл" : "Багц, чөлөөний үлдэгдэл, дараагийн хичээл"}
      />
      <PortalLoading query={summary} />
      {summary.data && students.length === 0 ? (
        <EmptyNote>
          {isParent
            ? "Таны данстай холбогдсон сурагч алга байна. Төвтэй холбогдоно уу."
            : "Таны данстай холбогдсон бүртгэл алга байна. Төвтэй холбогдоно уу."}
        </EmptyNote>
      ) : null}

      <div className="grid gap-9">
        {students.map((student) => {
          const next = nextLessonOf(lessons.data, student);
          return (
            <section key={student.studentId} className="grid gap-4">
              {isParent ? (
                <h2 className="font-display text-xl font-bold text-foreground-strong">
                  {student.fullName}
                  {student.grade ? (
                    <span className="ml-2 text-sm font-semibold text-muted">{student.grade}</span>
                  ) : null}
                </h2>
              ) : null}

              {next ? (
                <Card className="p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                    Дараагийн хичээл
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground-strong">
                    {weekdayName(weekdayOf(next.startsAt))} · {formatDate(next.startsAt)},{" "}
                    {formatTime(next.startsAt)}
                  </p>
                </Card>
              ) : null}

              {student.contracts.length === 0 ? (
                <EmptyNote>Идэвхтэй багц алга байна.</EmptyNote>
              ) : (
                student.contracts.map((contract) => (
                  <ContractSummary key={contract.id} contract={contract} />
                ))
              )}
            </section>
          );
        })}
      </div>

      {students.length > 0 ? (
        <div className="mt-9 grid gap-3 sm:grid-cols-2">
          <QuickLink
            to="/portal/schedule"
            icon={CalendarDays}
            title={isParent ? "Хүүхдийн хуваарь" : "Миний хуваарь"}
            text="Дараагийн 4 долоо хоногийн хичээл"
          />
          <QuickLink
            to="/portal/attendance"
            icon={ClipboardCheck}
            title={isParent ? "Хүүхдийн ирц" : "Миний ирц"}
            text="Ирцийн түүх, чөлөө хүсэх"
          />
          {isParent ? (
            <QuickLink
              to="/portal/payment"
              icon={Wallet}
              title="Багцын төлбөр"
              text="Төлбөр шилжүүлэх заавар"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// ФШ-23: эцэг эх "Таны хүүхдийн хуваарь", сурагч "Миний хуваарь". Хичээл бүр дээрээс чөлөө хүснэ (ФШ-30).
export function PortalSchedulePage() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const summary = usePortalSummary();
  const { selected, select } = useSelectedChild(summary.data?.students);
  const { from, to, today } = useRange(29);
  const lessons = useLessons(from, to);
  const overview = useAttendanceOverview(selected?.studentId);

  const classIds = classIdsOf(selected);
  const contractOfClass = contractByClassId(selected);
  const requested = new Set(overview.data?.leaveRequests.map((r) => r.lessonId));
  const upcoming = (lessons.data ?? []).filter(
    (l) => classIds.has(l.classId) && localDateKey(l.startsAt) >= today,
  );

  return (
    <>
      <PageHeader
        title={isParent ? "Таны хүүхдийн хуваарь" : "Миний хуваарь"}
        subtitle="Дараагийн 4 долоо хоногийн хичээл"
      />
      <PortalLoading query={summary} />
      {summary.data ? (
        <ChildPicker
          students={summary.data.students}
          selectedId={selected?.studentId}
          onSelect={select}
        />
      ) : null}
      <PortalLoading query={lessons} />
      {selected && lessons.data ? (
        <DayGroups
          lessons={upcoming}
          renderLesson={(lesson) => (
            <LessonCard
              lesson={lesson}
              actions={
                <LeaveRequestAction
                  lesson={lesson}
                  contractId={contractOfClass.get(lesson.classId)?.id}
                  requested={requested.has(lesson.id)}
                />
              }
            />
          )}
        />
      ) : null}
    </>
  );
}

// "Миний ирц": ирцийн түүх, багц, чөлөөний үлдэгдэл, ирэх хичээлд чөлөө хүсэх.
// Ирцийг багш бүртгэнэ, төлвийг сервер тооцно (ФШ-29), энд зөвхөн харагдана.
export function PortalAttendancePage() {
  const { user } = useAuth();
  const isParent = user?.role === "PARENT";
  const summary = usePortalSummary();
  const { selected, select } = useSelectedChild(summary.data?.students);
  const { from, to, today } = useRange(14);
  const lessons = useLessons(from, to);
  const overview = useAttendanceOverview(selected?.studentId);

  const classIds = classIdsOf(selected);
  const contractOfClass = contractByClassId(selected);
  const requested = new Set(overview.data?.leaveRequests.map((r) => r.lessonId));
  const upcoming = (lessons.data ?? []).filter(
    (l) =>
      classIds.has(l.classId) &&
      l.status === "SCHEDULED" &&
      new Date(l.startsAt).getTime() > Date.now() &&
      localDateKey(l.startsAt) >= today,
  );

  return (
    <>
      <PageHeader
        title={isParent ? "Хүүхдийн ирц" : "Миний ирц"}
        subtitle="Багц, чөлөө, ирцийн түүх"
      />
      <PortalLoading query={summary} />
      {summary.data ? (
        <ChildPicker
          students={summary.data.students}
          selectedId={selected?.studentId}
          onSelect={select}
        />
      ) : null}

      {selected ? (
        <div className="grid gap-9">
          <section className="grid gap-3">
            {selected.contracts.length === 0 ? (
              <EmptyNote>Идэвхтэй багц алга байна.</EmptyNote>
            ) : (
              selected.contracts.map((c) => <ContractSummary key={c.id} contract={c} />)
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Чөлөө хүсэх (ирэх 2 долоо хоног)
            </h2>
            {upcoming.length === 0 ? (
              <EmptyNote>Ирэх хичээл алга байна.</EmptyNote>
            ) : (
              <div className="grid gap-3">
                {upcoming.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    extra={`${weekdayName(weekdayOf(lesson.startsAt))} · ${formatDate(lesson.startsAt)}`}
                    actions={
                      <LeaveRequestAction
                        lesson={lesson}
                        contractId={contractOfClass.get(lesson.classId)?.id}
                        requested={requested.has(lesson.id)}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
              Ирцийн түүх
            </h2>
            <PortalLoading query={overview} />
            {overview.data && overview.data.records.length === 0 ? (
              <EmptyNote>Ирц хараахан бүртгэгдээгүй байна.</EmptyNote>
            ) : null}
            <div className="grid gap-2">
              {overview.data?.records.map((record) => (
                <Card key={record.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-foreground-strong">
                      {formatDate(record.startsAt)} · {formatTime(record.startsAt)}
                    </p>
                    <p className="text-[0.82rem] text-muted">{record.programName}</p>
                  </div>
                  <AttendanceStatusChip
                    status={record.status}
                    label={ATTENDANCE_STATUS_LABELS[record.status]}
                  />
                </Card>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-warm py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="break-words font-semibold text-foreground-strong">{value}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Хуулсан" : "Хуулах"}
      </Button>
    </div>
  );
}

// ФШ-49, ADR-016: банкны шилжүүлгийн заавар. Төлбөрийн төлөв (ФШ-77) төлбөрийн
// модуль (М7) хийгдсэний дараа энд нэмэгдэнэ.
function PaymentDialog({ contractId, onClose }: { contractId: string | null; onClose: () => void }) {
  const info = usePaymentInstructions(contractId);
  return (
    <Dialog.Root open={contractId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg">
          <Dialog.Title className="font-display text-lg font-bold text-foreground-strong">
            Төлбөр шилжүүлэх
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            Өөрийн банкны аппаар доорх данс руу шилжүүлнэ үү. Гүйлгээний утгыг заавал ижил бичнэ.
          </Dialog.Description>
          <div className="mt-4">
            <PortalLoading query={info} />
            {info.data ? (
              <>
                <CopyRow label="Банк" value={info.data.account.bankName} />
                <CopyRow label="Хүлээн авагч" value={info.data.account.accountHolder} />
                <CopyRow label="Дансны дугаар" value={info.data.account.accountNumber} />
                {info.data.account.iban ? (
                  <CopyRow label="IBAN" value={info.data.account.iban} />
                ) : null}
                <CopyRow label="Багцын үнэ" value={formatMoney(info.data.price)} />
                <CopyRow label="Гүйлгээний утга" value={info.data.transferNote} />
              </>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-muted">
            Шилжүүлсний дараа админ банкны хуулгаас тулгаж баталгаажуулна.
          </p>
          <div className="mt-5 flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Хаах
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Зөвхөн эцэг эх (ФШ-66): хүүхэд бүрийн багцын үнэ, үлдэгдэл, шилжүүлгийн заавар.
export function PortalPaymentPage() {
  const summary = usePortalSummary();
  const { selected, select } = useSelectedChild(summary.data?.students);
  const [contractId, setContractId] = React.useState<string | null>(null);

  return (
    <>
      <PageHeader title="Багцын төлбөр" subtitle="Багцын мэдээлэл, төлбөр шилжүүлэх заавар" />
      <PortalLoading query={summary} />
      {summary.data ? (
        <ChildPicker
          students={summary.data.students}
          selectedId={selected?.studentId}
          onSelect={select}
        />
      ) : null}

      {selected && selected.contracts.length === 0 ? (
        <EmptyNote>Багц алга байна.</EmptyNote>
      ) : null}
      <div className="grid gap-4">
        {selected?.contracts.map((contract) => (
          <div key={contract.id} className="grid gap-3">
            <ContractSummary contract={contract} />
            <div>
              <Button onClick={() => setContractId(contract.id)}>Төлбөр төлөх</Button>
            </div>
          </div>
        ))}
      </div>

      <PaymentDialog contractId={contractId} onClose={() => setContractId(null)} />
    </>
  );
}
