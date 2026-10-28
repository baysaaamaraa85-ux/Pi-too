import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClassSchema } from "@pitoo/contracts";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/app/app-shell";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, api } from "@/shared/api-client/client";
import { weekdayName, WEEKDAY_NAMES } from "@/shared/format/date";
import type { ClassDto } from "@/shared/api-client/types";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field, FormError, Select } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { useTeacherClasses } from "./today-page";

const formSchema = createClassSchema.omit({ teacherId: true }).extend({
  weekday: z.coerce.number().int().min(1).max(7),
});

// ФШ-19: анги үүсгэх (долоо хоног бүр давтагдах цаг, давхцлыг сервер шалгана, ФШ-25).
export function TeacherClassesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { classes, branches } = useTeacherClasses(user!.id);

  const form = useForm<z.input<typeof formSchema>, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { branchId: "", weekday: 1, startTime: "10:00" },
  });
  const errors = form.formState.errors;

  const create = useMutation({
    mutationFn: (values: z.output<typeof formSchema>) => api.post("/classes", values),
    onSuccess: () => {
      form.reset({ branchId: "", weekday: 1, startTime: "10:00" });
      // Анги үүсэхэд хичээлүүд нь шууд үүсдэг тул "Өнөөдөр", "Хуваарь" хуудас шинэчлэгдэнэ.
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });

  const [classToDelete, setClassToDelete] = React.useState<ClassDto | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/classes/${id}`),
    onSuccess: () => {
      setClassToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["lessons"] });
    },
  });
  const serverError =
    create.error instanceof ApiError ? create.error.problem.detail : create.error ? "Алдаа гарлаа." : null;

  return (
    <>
      <PageHeader title="Миний анги" subtitle="Долоо хоног бүр давтагдах хичээлийн цагууд" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Шинэ анги нэмэх</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
            className="grid gap-3.5 sm:grid-cols-3"
          >
            <Field label="Салбар" htmlFor="branchId" error={errors.branchId?.message}>
              <Select id="branchId" {...form.register("branchId")}>
                <option value="">Салбар сонгох</option>
                {branches.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Гараг" htmlFor="weekday" error={errors.weekday?.message}>
              <Select id="weekday" {...form.register("weekday")}>
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Эхлэх цаг" htmlFor="startTime" error={errors.startTime?.message}>
              <Input id="startTime" type="time" {...form.register("startTime")} />
            </Field>
            <div className="sm:col-span-3">
              <FormError message={serverError} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={create.isPending}>
                Анги үүсгэх
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {classes.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
        {classes.data?.length === 0 ? (
          <p className="text-sm text-muted">Анги бүртгэгдээгүй байна.</p>
        ) : null}
        {classes.data?.map((cls) => (
          <Card key={cls.id} className="p-5">
            <p className="text-lg font-bold text-foreground-strong">
              {weekdayName(cls.weekday)} · {cls.startTime}
            </p>
            <p className="mt-1 text-sm text-muted">
              {branches.data?.find((b) => b.id === cls.branchId)?.name ?? "Салбар"} ·{" "}
              {cls.durationMin} минут · {cls.capacity} суудал
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => {
                remove.reset();
                setClassToDelete(cls);
              }}
            >
              Анги устгах
            </Button>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={classToDelete !== null}
        title="Анги устгах уу?"
        description={`${
          remove.error instanceof ApiError ? remove.error.problem.detail + " " : ""
        }${
          classToDelete ? `${weekdayName(classToDelete.weekday)} ${classToDelete.startTime} ангийг устгавал ирэх хичээлүүд хуваариас арилна. ` : ""
        }Өнгөрсөн хичээл, ирцийн түүх хадгалагдана.`}
        confirmLabel="Устгах"
        busy={remove.isPending}
        onConfirm={() => classToDelete && remove.mutate(classToDelete.id)}
        onClose={() => setClassToDelete(null)}
      />
    </>
  );
}
