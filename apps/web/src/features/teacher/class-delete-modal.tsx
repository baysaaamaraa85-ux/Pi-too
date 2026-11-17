import type { ClassRosterDto, ClassRosterStudentDto } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto, ClassDto } from "@/shared/api-client/types";
import { weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { FormError, Select } from "@/shared/ui/field";
import { Modal } from "@/shared/ui/modal";
import { StatusChip } from "@/shared/ui/status-chip";

const tomorrowKey = () => new Date(Date.now() + 86_400_000 + 8 * 3_600_000).toISOString().slice(0, 10);

function classOption(c: AvailableClassDto) {
  return `${weekdayName(c.weekday)} ${c.startTime} · ${c.branchName} · ${c.teacherName} (${c.capacity - c.availableSeats}/${c.capacity})`;
}

function MoveRow({
  student,
  fromClassId,
  options,
}: {
  student: ClassRosterStudentDto;
  fromClassId: string;
  options: AvailableClassDto[];
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = React.useState("");
  // Сурагч аль хэдийн бүртгэлтэй ангийг санал болгохгүй.
  const choices = options.filter((o) => !student.classIds.includes(o.id));
  const move = useMutation({
    mutationFn: () =>
      api.post(`/contracts/${student.contractId}/transfer`, {
        fromClassId,
        toClassId: target,
        effectiveFrom: tomorrowKey(),
        reason: "Анги устгахын өмнө өөр ангид зөөв",
      }),
    onSuccess: async () => {
      for (const key of ["class-roster", "available-classes", "week-classes", "classes", "contracts", "lessons"]) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
  return (
    <li className="rounded-xl border border-border-warm p-3" data-testid="move-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground-strong">{student.studentName}</p>
        <StatusChip tone={student.paymentFlag === "DEBT" ? "warning" : "success"}>
          {student.paymentFlag === "DEBT" ? "Төлөгдөөгүй" : "Төлөгдсөн"}
        </StatusChip>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Select aria-label={`${student.studentName}: шинэ анги`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Шинэ анги сонгох</option>
          {choices.map((o) => (
            <option key={o.id} value={o.id}>
              {classOption(o)}
            </option>
          ))}
        </Select>
        <Button type="button" disabled={!target || move.isPending} onClick={() => move.mutate()}>
          {move.isPending ? "Зөөж байна..." : "Зөөх"}
        </Button>
      </div>
      <FormError message={errorMessage(move.error)} />
    </li>
  );
}

// D-69: анги устгахад тухайн ангийн сурагчдыг харуулж, багш өөрөө өөр сул зайтай анги руу зөөнө. Хоосорсны дараа устгана.
export function ClassDeleteModal({ cls, onClose }: { cls: ClassDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const roster = useQuery({
    queryKey: ["class-roster", cls.id],
    queryFn: () => api.get<ClassRosterDto>(`/classes/${cls.id}/students`),
  });
  // D-69: анги устгахад зөвхөн энэ багшийн бусад боломжит (сул зайтай) ангиуд. Багш солих бол сурагчийн
  // хуудаснаас "Шилжүүлэх"-ээр бүх багшийн ангиас сонгоно.
  const available = useQuery({
    queryKey: ["available-classes", "move", cls.id, cls.teacherId],
    queryFn: () => api.get<AvailableClassDto[]>(`/classes/available?teacherId=${cls.teacherId}`),
  });
  const options = (available.data ?? []).filter((c) => c.id !== cls.id && c.teacherId === cls.teacherId);
  const students = roster.data?.students ?? [];
  const empty = roster.data !== undefined && students.length === 0;

  const remove = useMutation({
    mutationFn: () => api.delete(`/classes/${cls.id}`),
    onSuccess: async () => {
      for (const key of ["classes", "lessons", "week-classes", "available-classes"]) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
  });

  return (
    <Modal
      open
      title={`Анги устгах: ${weekdayName(cls.weekday)} ${cls.startTime}`}
      description="Ангид сурагч байвал эхлээд өөр сул зайтай анги руу зөөнө. Хоосорсны дараа анги устна. Өнгөрсөн хичээл, ирцийн түүх хадгалагдана."
      onClose={onClose}
    >
      <div className="grid gap-3">
        {roster.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
        {empty ? (
          <p className="rounded-xl bg-background-soft px-3.5 py-2.5 text-sm font-semibold text-success" data-testid="class-empty">
            Ангид сурагч алга. Устгаж болно.
          </p>
        ) : null}
        {students.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-foreground-strong" data-testid="class-remaining">
              Ангид {students.length} сурагч байна
            </p>
            {options.length === 0 && available.data ? (
              <p className="text-sm text-warning">
                Таны сул зайтай өөр анги алга. Шинэ анги үүсгэх эсвэл сурагчийн хуудаснаас өөр багшийн анги руу шилжүүлнэ үү.
              </p>
            ) : null}
            <ul className="grid max-h-[50vh] gap-2 overflow-y-auto">
              {students.map((s) => (
                <MoveRow key={s.contractId} student={s} fromClassId={cls.id} options={options} />
              ))}
            </ul>
          </>
        ) : null}
        <FormError message={errorMessage(remove.error)} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!empty || remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? "Устгаж байна..." : "Анги устгах"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Болих
          </Button>
        </div>
      </div>
    </Modal>
  );
}
