import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { ApiError, api } from "@/shared/api-client/client";
import type { LessonDto } from "@/shared/api-client/types";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Field, FormError } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

function errorText(error: unknown) {
  return error instanceof ApiError ? error.problem.detail : "Алдаа гарлаа.";
}

// "2026-11-03T10:00" (Улаанбаатарын цаг) -> UTC ISO. Улаанбаатар UTC+8, DST байхгүй.
function ubLocalToIso(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

// ФШ-24, 60: хичээл цуцлах, шилжүүлэх (мөнгө, мэдэгдэлд нөлөөлөх тул баталгаажуулалттай, ФБШ-12).
export function LessonActions({ lesson }: { lesson: LessonDto }) {
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");

  const onDone = () => void queryClient.invalidateQueries({ queryKey: ["lessons"] });

  const cancel = useMutation({
    mutationFn: () => api.post(`/lessons/${lesson.id}/cancel`),
    onSuccess: () => {
      setConfirmCancel(false);
      onDone();
    },
  });

  const reschedule = useMutation({
    mutationFn: () =>
      api.post(`/lessons/${lesson.id}/reschedule`, {
        startsAt: ubLocalToIso(startsAt),
        endsAt: ubLocalToIso(endsAt),
      }),
    onSuccess: () => {
      setRescheduleOpen(false);
      onDone();
    },
  });

  if (lesson.status === "CANCELLED") return null;

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          reschedule.reset();
          setRescheduleOpen(true);
        }}
      >
        Цаг шилжүүлэх
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          cancel.reset();
          setConfirmCancel(true);
        }}
      >
        Цуцлах
      </Button>

      <ConfirmDialog
        open={confirmCancel}
        title="Хичээл цуцлах уу?"
        description={`${
          cancel.error ? errorText(cancel.error) + " " : ""
        }Хичээлд хамрагдах сурагч, эцэг эхэд мэдэгдэл очно.`}
        confirmLabel="Цуцлах"
        busy={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onClose={() => setConfirmCancel(false)}
      />

      <Dialog.Root open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-lg">
            <Dialog.Title className="font-display text-lg font-bold text-foreground-strong">
              Хичээлийн цаг шилжүүлэх
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              Шинэ эхлэх, дуусах цагийг Улаанбаатарын цагаар оруулна уу.
            </Dialog.Description>
            <div className="mt-4 grid gap-3.5">
              <Field label="Эхлэх" htmlFor="rs-start">
                <Input
                  id="rs-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>
              <Field label="Дуусах" htmlFor="rs-end">
                <Input
                  id="rs-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </Field>
              <FormError message={reschedule.error ? errorText(reschedule.error) : null} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setRescheduleOpen(false)}>
                Болих
              </Button>
              <Button
                size="sm"
                disabled={!startsAt || !endsAt || reschedule.isPending}
                onClick={() => reschedule.mutate()}
              >
                Шилжүүлэх
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
