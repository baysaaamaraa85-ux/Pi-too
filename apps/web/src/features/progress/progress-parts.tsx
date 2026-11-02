import {
  ASSESSMENT_TYPE_LABELS,
  NOTE_VISIBILITY_LABELS,
  type AssessmentDto,
  type NoteDto,
  type NoteVisibility,
  type ProgressDto,
} from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import { formatDate } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";

export function useProgress(studentId: string) {
  return useQuery({
    queryKey: ["progress", studentId],
    queryFn: () => api.get<ProgressDto>(`/students/${studentId}/progress`),
  });
}

// ФШ-41: шугаман график. Утга өнгөөр биш цэг бүрийн хувь бичвэрээр, доор нь хүснэгт.
export function ProgressChart({ assessments }: { assessments: AssessmentDto[] }) {
  const width = 320;
  const height = 140;
  const pad = { left: 30, right: 12, top: 12, bottom: 22 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (assessments.length <= 1 ? innerW / 2 : (i / (assessments.length - 1)) * innerW);
  const y = (pct: number) => pad.top + innerH - (pct / 100) * innerH;
  const points = assessments.map((a, i) => `${x(i)},${y(Number(a.totalPercent))}`).join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Дүнгийн график: ${assessments.length} цэг`}
        className="w-full max-w-lg"
        data-testid="progress-chart"
      >
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={pad.left} x2={width - pad.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeDasharray="3 3" />
            <text x={pad.left - 4} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">
              {g}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points={points} />
        {assessments.map((a, i) => (
          <g key={a.id} data-testid="chart-point">
            <circle cx={x(i)} cy={y(Number(a.totalPercent))} r="3.5" fill="var(--color-primary)" />
            <text x={x(i)} y={y(Number(a.totalPercent)) - 7} textAnchor="middle" fontSize="9" fill="var(--color-foreground)">
              {Number(a.totalPercent)}%
            </text>
          </g>
        ))}
      </svg>
      <table className="mt-2 w-full max-w-lg text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-1">Огноо</th>
            <th>Төрөл</th>
            <th className="text-right">Дүн</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-warm">
          {assessments.map((a) => (
            <tr key={a.id}>
              <td className="py-1.5">{formatDate(a.takenOn)}</td>
              <td>{ASSESSMENT_TYPE_LABELS[a.type]}</td>
              <td className="text-right font-semibold">{Number(a.totalPercent)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProgressSection({ studentId, action }: { studentId: string; action?: React.ReactNode }) {
  const progress = useProgress(studentId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Сорил, шалгалтын дүн</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {progress.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
        {progress.data && progress.data.assessments.length === 0 ? (
          <p className="text-sm text-muted">Дүн бүртгэгдээгүй байна.</p>
        ) : null}
        {progress.data && progress.data.assessments.length > 0 ? (
          <ProgressChart assessments={progress.data.assessments} />
        ) : null}
        {progress.data && progress.data.weakTopics.length > 0 ? (
          <div className="mt-4" data-testid="weak-topics">
            <p className="mb-1.5 text-sm font-bold text-foreground-strong">
              Сул сэдвүүд ({progress.data.weakTopicThresholdPercent}%-иас доош)
            </p>
            <div className="flex flex-wrap gap-2">
              {progress.data.weakTopics.map((t) => (
                <StatusChip key={t.topic} tone="warning">
                  {t.topic}: {Number(t.scorePercent)}%
                </StatusChip>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface TopicRow {
  topic: string;
  score: string;
}

// ФШ-38: сорил, шалгалт бүртгэх маягт.
export function AssessmentModal({
  studentId,
  contractId,
  onClose,
}: {
  studentId: string;
  contractId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = React.useState<"QUIZ" | "BATCH_EXAM">("QUIZ");
  const [takenOn, setTakenOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = React.useState("");
  const [topics, setTopics] = React.useState<TopicRow[]>([]);
  const [result, setResult] = React.useState<{
    totalPercent: string;
    freeReviewsGranted: number;
    reviewTopics: string[];
  } | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api.post<NonNullable<typeof result>>(`/students/${studentId}/assessments`, {
        type,
        contractId,
        takenOn,
        totalPercent: topics.length === 0 && total ? Number(total) : undefined,
        topics: topics
          .filter((t) => t.topic.trim() && t.score !== "")
          .map((t) => ({ topic: t.topic.trim(), scorePercent: Number(t.score) })),
      }),
    onSuccess: async (data) => {
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: ["progress", studentId] });
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });

  if (result) {
    return (
      <Modal open title="Дүн бүртгэгдлээ" onClose={onClose}>
        <p className="text-sm text-mid" data-testid="assessment-result">
          Нийт дүн: <strong>{Number(result.totalPercent)}%</strong>
        </p>
        {result.freeReviewsGranted > 0 ? (
          <p className="mt-2 rounded-xl bg-warning-bg px-3.5 py-2.5 text-sm font-semibold text-warning">
            Босгоос доош тул {result.freeReviewsGranted} үнэгүй давтлагын эрх үүслээ.
            {result.reviewTopics.length ? ` Давтах сэдэв: ${result.reviewTopics.join(", ")}.` : ""}
          </p>
        ) : null}
        <Button className="mt-4" onClick={onClose}>
          Хаах
        </Button>
      </Modal>
    );
  }

  const hasTopics = topics.length > 0;
  return (
    <Modal open title="Сорил, шалгалт бүртгэх" onClose={onClose}>
      <div className="grid gap-3.5">
        <Field label="Төрөл" htmlFor="as-type">
          <Select id="as-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="QUIZ">{ASSESSMENT_TYPE_LABELS.QUIZ}</option>
            <option value="BATCH_EXAM">{ASSESSMENT_TYPE_LABELS.BATCH_EXAM}</option>
          </Select>
        </Field>
        <Field label="Огноо" htmlFor="as-date">
          <Input id="as-date" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
        </Field>
        {!hasTopics ? (
          <Field label="Нийт хувь (0-100)" htmlFor="as-total">
            <Input id="as-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
        ) : (
          <p className="text-xs text-muted">Нийт хувь сэдвийн онооны дундажаар тооцогдоно.</p>
        )}
        {topics.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px] gap-2">
            <Input
              aria-label={`Сэдэв ${i + 1}`}
              placeholder="Сэдэв"
              value={t.topic}
              onChange={(e) => setTopics((p) => p.map((r, j) => (j === i ? { ...r, topic: e.target.value } : r)))}
            />
            <Input
              aria-label={`Оноо ${i + 1}`}
              placeholder="%"
              inputMode="decimal"
              value={t.score}
              onChange={(e) => setTopics((p) => p.map((r, j) => (j === i ? { ...r, score: e.target.value } : r)))}
            />
          </div>
        ))}
        <Button variant="secondary" className="w-fit" onClick={() => setTopics((p) => [...p, { topic: "", score: "" }])}>
          Сэдэв нэмэх
        </Button>
        <FormError message={errorMessage(save.error)} />
        <Button
          className="w-fit"
          disabled={save.isPending || (!hasTopics && total === "")}
          onClick={() => save.mutate()}
        >
          Бүртгэх
        </Button>
      </div>
    </Modal>
  );
}

export function NotesPanel({
  contractId,
  canSeeInternal = true,
}: {
  contractId: string;
  canSeeInternal?: boolean;
}) {
  const notes = useQuery({
    queryKey: ["notes", contractId],
    queryFn: () => api.get<NoteDto[]>(`/contracts/${contractId}/notes`),
  });
  const visible = notes.data?.filter((n) => canSeeInternal || n.visibility === "SHARED") ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Хичээлийн тэмдэглэл</CardTitle>
      </CardHeader>
      <CardContent>
        {notes.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
        {notes.data && visible.length === 0 ? <p className="text-sm text-muted">Тэмдэглэл алга.</p> : null}
        <ul className="grid gap-3" data-testid="notes-list">
          {visible.map((n) => (
            <li key={n.id} className="rounded-xl border border-border-warm p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {formatDate(n.lessonStartsAt)} · {n.authorName}
                </span>
                <StatusChip tone={n.visibility === "SHARED" ? "info" : "neutral"}>
                  {NOTE_VISIBILITY_LABELS[n.visibility]}
                </StatusChip>
              </div>
              <p className="whitespace-pre-wrap text-mid">{n.body}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Ирцийн дэлгэцийн мөрөөс хичээлийн тэмдэглэл бичих (ФШ-44).
export function NoteModal({
  lessonId,
  contractId,
  studentName,
  onClose,
}: {
  lessonId: string;
  contractId: string;
  studentName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = React.useState<NoteVisibility>("INTERNAL");
  const [body, setBody] = React.useState("");
  const save = useMutation({
    mutationFn: () => api.post(`/lessons/${lessonId}/notes`, { contractId, visibility, body }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes", contractId] });
      onClose();
    },
  });
  return (
    <Modal open title={`Хичээлийн тэмдэглэл: ${studentName}`} onClose={onClose}>
      <div className="grid gap-3.5">
        <Field label="Харагдах эрх" htmlFor="note-vis" hint="Хуваалцсан тэмдэглэлийг эцэг эх харна.">
          <Select id="note-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as NoteVisibility)}>
            <option value="INTERNAL">{NOTE_VISIBILITY_LABELS.INTERNAL}</option>
            <option value="SHARED">{NOTE_VISIBILITY_LABELS.SHARED}</option>
          </Select>
        </Field>
        <Field label="Тэмдэглэл" htmlFor="note-body">
          <textarea
            id="note-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-border bg-background-soft p-3 text-sm focus:border-primary focus:outline-none"
          />
        </Field>
        <FormError message={errorMessage(save.error)} />
        <Button className="w-fit" disabled={!body.trim() || save.isPending} onClick={() => save.mutate()}>
          Хадгалах
        </Button>
      </div>
    </Modal>
  );
}

interface MeetingDto {
  id: string;
  metOn: string;
  summary: string;
  teacherName: string;
}

// ФШ-45, 43: эцэг эхтэй хийсэн уулзалт.
export function MeetingsPanel({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const meetings = useQuery({
    queryKey: ["meetings", contractId],
    queryFn: () => api.get<MeetingDto[]>(`/contracts/${contractId}/meetings`),
  });
  const [open, setOpen] = React.useState(false);
  const [metOn, setMetOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = React.useState("");
  const add = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/meetings`, { metOn, summary }),
    onSuccess: async () => {
      setSummary("");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["meetings", contractId] });
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Эцэг эхтэй уулзалт ({meetings.data?.length ?? 0})</CardTitle>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Уулзалт бүртгэх
        </Button>
      </CardHeader>
      <CardContent>
        {meetings.data?.length === 0 ? <p className="text-sm text-muted">Уулзалт бүртгэгдээгүй.</p> : null}
        <ul className="grid gap-2 text-sm">
          {meetings.data?.map((m) => (
            <li key={m.id} className="rounded-xl border border-border-warm p-3">
              <p className="text-xs text-muted">
                {formatDate(m.metOn)} · {m.teacherName}
              </p>
              <p className="text-mid">{m.summary}</p>
            </li>
          ))}
        </ul>
      </CardContent>
      {open ? (
        <Modal open title="Эцэг эхтэй уулзсан" onClose={() => setOpen(false)}>
          <div className="grid gap-3.5">
            <Field label="Огноо" htmlFor="meet-date">
              <Input id="meet-date" type="date" value={metOn} onChange={(e) => setMetOn(e.target.value)} />
            </Field>
            <Field label="Дүгнэлт" htmlFor="meet-summary">
              <Input id="meet-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
            </Field>
            <FormError message={errorMessage(add.error)} />
            <Button className="w-fit" disabled={!summary.trim() || add.isPending} onClick={() => add.mutate()}>
              Хадгалах
            </Button>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}
