import type { TransferResultDto } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto } from "@/shared/api-client/types";
import { localDateKey, weekdayName, addDaysToKey } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { useInvalidateDirectory, type ClassLabel } from "./directory-api";
import { errorMessage } from "./list-kit";

// ФШ-71: гэрээг өөр анги (салбар, багш) руу шилжүүлнэ. Үлдэгдэл, чөлөө, дүнгийн түүх хэвээр,
// өмнөх цалин хуучин багшид хэвээр, шинэ анги нь сонгосон өдрөөс эхэлнэ.
export function TransferModal({
  contractId,
  from,
  studentName,
  onClose,
}: {
  contractId: string;
  from: ClassLabel;
  studentName: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidateDirectory();
  const queryClient = useQueryClient();
  const tomorrow = addDaysToKey(localDateKey(new Date()), 1);
  const [toClassId, setToClassId] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState(tomorrow);
  const [reason, setReason] = React.useState("");

  const classes = useQuery({
    queryKey: ["available-classes", "transfer"],
    queryFn: () => api.get<AvailableClassDto[]>("/classes/available"),
  });
  const options = (classes.data ?? []).filter((c) => c.id !== from.id);

  const transfer = useMutation({
    mutationFn: () =>
      api.post<TransferResultDto>(`/contracts/${contractId}/transfer`, {
        fromClassId: from.id,
        toClassId,
        effectiveFrom,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      await invalidate();
      // Багшийн хуудсууд: сурагчид, хуваарь, ангийн жагсаалт.
      for (const key of ["contracts", "week-classes", "class-roster", "available-classes", "classes", "lessons"]) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
  });

  const ready = toClassId !== "" && effectiveFrom !== "" && reason.trim() !== "";

  return (
    <Modal
      open
      title={`Шилжүүлэх: ${studentName}`}
      description={`Одоогийн анги: ${from.branchName} · ${weekdayName(from.weekday)} ${from.startTime} · ${from.teacherName}`}
      onClose={onClose}
    >
      <form
        className="grid gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) transfer.mutate();
        }}
      >
        <Field label="Шинэ анги" htmlFor="transfer-class">
          <Select id="transfer-class" value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
            <option value="">Сонгох</option>
            {options.map((c) => (
              <option key={c.id} value={c.id} disabled={c.availableSeats <= 0}>
                {c.branchName} · {weekdayName(c.weekday)} {c.startTime} · {c.teacherName} (сул {c.availableSeats})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Шинэ ангид эхлэх өдөр" htmlFor="transfer-date" hint="Өнөөдөр эсвэл дараагийн өдөр">
          <Input
            id="transfer-date"
            type="date"
            min={localDateKey(new Date())}
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
        </Field>
        <Field label="Шалтгаан" htmlFor="transfer-reason">
          <Input id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <p className="text-xs text-muted">
          Багцын үлдэгдэл, чөлөөний эрх, дүнгийн түүх өөрчлөгдөхгүй. Өмнөх хичээлийн цалин хуучин
          багшид хэвээр үлдэнэ.
        </p>
        {transfer.error ? <FormError message={errorMessage(transfer.error)} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Болих
          </Button>
          <Button type="submit" disabled={!ready || transfer.isPending}>
            Шилжүүлэх
          </Button>
        </div>
      </form>
    </Modal>
  );
}
