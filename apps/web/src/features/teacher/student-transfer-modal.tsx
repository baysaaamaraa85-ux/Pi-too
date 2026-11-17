import type { TransferResultDto } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import * as React from "react";
import { errorMessage } from "@/features/admin/list-kit";
import { useAuth } from "@/features/auth/auth-context";
import { api } from "@/shared/api-client/client";
import type { AvailableClassDto } from "@/shared/api-client/types";
import { addDaysToKey, localDateKey, weekdayName } from "@/shared/format/date";
import { Button } from "@/shared/ui/button";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Modal } from "@/shared/ui/modal";
import { cn } from "@/shared/ui/utils";

// D-73: багшийн "Сурагч шилжүүлэх" нэг цонх. Сурагчаа хайж олоод, түүний бүх цаг (анги) бүрт
// төвийн бусад багшийн цагаас шинийг сонгоно. Бүгд нэг дор (нэг транзакц) шилжинэ (ФШ-71).
// Салбар зэрэг нэмэлт мэдээлэл харуулахгүй: гараг, цаг, багш, сул суудал.

export interface TransferTarget {
  id: string;
  studentName: string;
  programName: string;
  status: string;
  classes: { id: string; weekday: number; startTime: string; teacherId: string; teacherName: string }[];
}

function useSearchResults(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["contracts", "transfer-search", search],
    enabled,
    queryFn: () => {
      const params = new URLSearchParams({ page: "1", limit: "8" });
      if (search.trim()) params.set("search", search.trim());
      return api.get<{ items: TransferTarget[] }>(`/contracts?${params.toString()}`);
    },
  });
}

export function StudentTransferModal({
  initial,
  onClose,
}: {
  // Сурагчийн картаас нээсэн бол сурагч бэлэн, хайлтгүй.
  initial?: TransferTarget;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [picked, setPicked] = React.useState<TransferTarget | null>(initial ?? null);
  const [choices, setChoices] = React.useState<Record<string, string>>({});
  const [effectiveFrom, setEffectiveFrom] = React.useState(addDaysToKey(localDateKey(new Date()), 1));
  const [reason, setReason] = React.useState("Багш, цаг солих");

  const results = useSearchResults(search, picked === null);
  const classes = useQuery({
    queryKey: ["available-classes", "transfer"],
    queryFn: () => api.get<AvailableClassDto[]>("/classes/available"),
    enabled: picked !== null,
  });

  const move = useMutation({
    mutationFn: () =>
      api.post<TransferResultDto[]>(`/contracts/${picked!.id}/transfer-many`, {
        moves: Object.entries(choices)
          .filter(([, to]) => to !== "")
          .map(([fromClassId, toClassId]) => ({ fromClassId, toClassId })),
        effectiveFrom,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      for (const key of ["contracts", "week-classes", "class-roster", "available-classes", "classes", "lessons", "students", "student"]) {
        await queryClient.invalidateQueries({ queryKey: [key] });
      }
      onClose();
    },
  });

  const chosenCount = Object.values(choices).filter((v) => v !== "").length;
  const ready = picked !== null && chosenCount > 0 && effectiveFrom !== "" && reason.trim() !== "";

  if (picked === null) {
    const list = (results.data?.items ?? []).filter((c) => c.status === "ACTIVE");
    return (
      <Modal open title="Сурагч шилжүүлэх" description="Шилжүүлэх сурагчаа хайж сонгоно уу." onClose={onClose}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            aria-label="Шилжүүлэх сурагч хайх"
            placeholder="Сурагчийн нэр"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>
        {results.isLoading ? <p className="mt-3 text-sm text-muted">Ачаалж байна...</p> : null}
        {results.data && list.length === 0 ? <p className="mt-3 text-sm text-muted">Идэвхтэй сурагч олдсонгүй.</p> : null}
        <ul className="mt-3 grid gap-1.5">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPicked(c)}
                className="flex min-h-12 w-full flex-col justify-center rounded-xl border border-border-warm bg-background-soft/60 px-3.5 py-1.5 text-left hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="text-sm font-semibold text-foreground-strong">{c.studentName}</span>
                <span className="text-[0.8125rem] text-muted">{c.programName}</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  // Шинэ цагийн сонголт: одоогийн ангиудаас бусад, багшаар бүлэглэсэн.
  const currentIds = new Set(picked.classes.map((c) => c.id));
  const options = (classes.data ?? []).filter((c) => !currentIds.has(c.id));
  const byTeacher = new Map<string, AvailableClassDto[]>();
  for (const c of options) byTeacher.set(c.teacherName, [...(byTeacher.get(c.teacherName) ?? []), c]);
  const ownClasses = picked.classes.filter((c) => c.teacherId === user?.id);
  const otherClasses = picked.classes.filter((c) => c.teacherId !== user?.id);

  return (
    <Modal open title={`Шилжүүлэх: ${picked.studentName}`} description={picked.programName} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) move.mutate();
        }}
      >
        <ul className="grid gap-2.5">
          {ownClasses.map((c) => (
            <li key={c.id} className="grid gap-1.5 rounded-xl border border-border-warm bg-background-soft/50 p-3">
              <p className="text-sm font-semibold text-foreground-strong">
                {weekdayName(c.weekday)} {c.startTime}
                <span className="font-normal text-muted"> · одоогийн цаг</span>
              </p>
              <Select
                aria-label={`Шинэ цаг: ${weekdayName(c.weekday)} ${c.startTime}`}
                value={choices[c.id] ?? ""}
                onChange={(e) => setChoices((prev) => ({ ...prev, [c.id]: e.target.value }))}
                className={cn(choices[c.id] ? "border-primary" : "")}
              >
                <option value="">Шилжүүлэхгүй</option>
                {[...byTeacher.entries()].map(([teacher, items]) => (
                  <optgroup key={teacher} label={teacher}>
                    {items.map((o) => (
                      <option key={o.id} value={o.id} disabled={o.availableSeats <= 0}>
                        {weekdayName(o.weekday)} {o.startTime} · {teacher} (сул {o.availableSeats})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </li>
          ))}
        </ul>
        {otherClasses.length > 0 ? (
          <p className="text-[0.8125rem] text-muted">
            Өөр багшийн цаг: {otherClasses.map((c) => `${weekdayName(c.weekday)} ${c.startTime} (${c.teacherName})`).join(", ")}. Эдгээрийг тэр багш шилжүүлнэ.
          </p>
        ) : null}
        {classes.isLoading ? <p className="text-sm text-muted">Цагуудыг ачаалж байна...</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Шинэ цагт эхлэх өдөр" htmlFor="tr-date">
            <Input id="tr-date" type="date" min={localDateKey(new Date())} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
          <Field label="Шалтгаан" htmlFor="tr-reason">
            <Input id="tr-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <p className="text-[0.8125rem] text-muted">
          Багцын үлдэгдэл, чөлөө, дүн өөрчлөгдөхгүй. Өмнөх хичээлийн цалин танд хэвээр үлдэнэ.
        </p>
        {move.error ? <FormError message={errorMessage(move.error)} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Болих
          </Button>
          <Button type="submit" disabled={!ready || move.isPending}>
            Шилжүүлэх{chosenCount > 1 ? ` (${chosenCount})` : ""}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
