import { CONTRACT_STATUS_LABELS, type ContractStatus, type Paginated } from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { Link, useParams } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { StatusChip } from "@/shared/ui/status-chip";
import { ContractRateCard } from "@/features/payroll/rates-ui";
import { formatHours } from "@/shared/format/hours";
import {
  AssessmentModal,
  MeetingsPanel,
  NotesPanel,
  ProgressSection,
} from "@/features/progress/progress-parts";

interface ContractRow {
  id: string;
  studentId: string;
  studentName: string;
  programName: string;
  status: ContractStatus;
  totalHours: number;
  remainingHours: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  meetingsCount: number;
  classes: { id: string; branchName: string; weekday: number; startTime: string }[];
}

// Багшийн сурагчийн дэлгэрэнгүй: сорилын график, сул сэдэв, тэмдэглэл, уулзалт (М6).
export function TeacherStudentDetailPage() {
  const { studentId = "" } = useParams();
  const [assessing, setAssessing] = React.useState<string | null>(null);
  const contracts = useQuery({
    queryKey: ["contracts", "student", studentId],
    queryFn: () => api.get<Paginated<ContractRow>>("/contracts?limit=100"),
  });
  const mine = contracts.data?.items.filter((c) => c.studentId === studentId) ?? [];
  const name = mine[0]?.studentName ?? "Сурагч";

  return (
    <>
      <PageHeader
        title={name}
        subtitle="Явц, сорил, тэмдэглэл"
        action={
          <Link to="/teacher/students" className="text-sm font-semibold text-primary hover:underline">
            Сурагчид руу буцах
          </Link>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          {mine.map((c) => (
            <Card key={c.id} className="p-5" data-testid="detail-contract">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{c.programName}</strong>
                <StatusChip tone={c.status === "ACTIVE" ? "success" : "neutral"}>
                  {CONTRACT_STATUS_LABELS[c.status]}
                </StatusChip>
              </div>
              <p className="mt-1 text-sm text-mid">
                Багц {formatHours(c.remainingHours)}/{formatHours(c.totalHours)} цаг · Чөлөө {c.leavesLeft}
                {c.freeReviewsLeft > 0 ? ` · Үнэгүй давтлага ${c.freeReviewsLeft}` : ""}
              </p>
              {c.classes.map((cls) => (
                <p key={cls.id} className="text-sm text-muted">
                  {cls.branchName}, {weekdayName(cls.weekday)} {cls.startTime}
                </p>
              ))}
              <ContractRateCard contractId={c.id} />
              <Button className="mt-3" onClick={() => setAssessing(c.id)}>
                Сорил, шалгалт бүртгэх
              </Button>
              {assessing === c.id ? (
                <AssessmentModal studentId={studentId} contractId={c.id} onClose={() => setAssessing(null)} />
              ) : null}
            </Card>
          ))}
          <ProgressSection studentId={studentId} />
        </div>
        <div className="grid content-start gap-5">
          {mine.map((c) => (
            <React.Fragment key={c.id}>
              <MeetingsPanel contractId={c.id} />
              <NotesPanel contractId={c.id} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
