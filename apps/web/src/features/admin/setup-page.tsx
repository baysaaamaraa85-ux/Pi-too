import { useQuery } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { api } from "@/shared/api-client/client";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/ui/utils";

interface SetupStep {
  key: "branches" | "programs" | "teachers" | "classes" | "students";
  count: number;
  done: boolean;
  unlocked: boolean;
}

const STEP_INFO: Record<SetupStep["key"], { title: string; text: string; to: string; action: string }> = {
  branches: {
    title: "Салбар",
    text: "Төвийн салбаруудаа бүртгэнэ.",
    to: "/admin/catalog",
    action: "Салбар нэмэх",
  },
  programs: {
    title: "Хөтөлбөр",
    text: "Хөтөлбөр бүрийн багцын үнийг тогтооно.",
    to: "/admin/catalog",
    action: "Хөтөлбөр нэмэх",
  },
  teachers: {
    title: "Багш",
    text: "Багшийн данс үүсгэж, цагийн үнэлгээг тогтооно.",
    to: "/admin/teachers",
    action: "Багш нэмэх",
  },
  classes: {
    title: "Анги",
    text: "Багш өөрийн ангийг (салбар, гараг, цаг) үүсгэнэ.",
    to: "/admin/teachers",
    action: "Багш нарыг харах",
  },
  students: {
    title: "Сурагч",
    text: "Эцэг эх, сурагч, багц, ангийг нэг дор бүртгэнэ.",
    to: "/admin/enroll",
    action: "Сурагч бүртгэх",
  },
};

// ФШ-11: салбар, хөтөлбөр, багш, анги, сурагч гэсэн дараалалтай тохиргооны шидтэн.
// Өмнөх алхам дуусаагүй бол дараагийнх идэвхжихгүй (сервер тооцно).
export function AdminSetupPage() {
  const status = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => api.get<SetupStep[]>("/setup/status"),
  });

  return (
    <>
      <PageHeader title="Анхны тохиргоо" subtitle="Системийг ашиглаж эхлэх 5 алхам" />
      {status.isLoading ? <p className="text-sm text-muted">Ачаалж байна...</p> : null}
      <ol className="grid max-w-2xl gap-3">
        {status.data?.map((step, index) => {
          const info = STEP_INFO[step.key];
          return (
            <li key={step.key}>
              <Card
                className={cn("flex items-center gap-4 p-5", !step.unlocked && "opacity-60")}
                data-testid={`setup-${step.key}`}
                data-unlocked={step.unlocked}
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full border-2 text-sm font-bold",
                    step.done
                      ? "border-success bg-success text-white"
                      : "border-border text-muted",
                  )}
                >
                  {step.done ? <Check className="size-5" /> : step.unlocked ? index + 1 : <Lock className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-foreground-strong">
                    {info.title}{" "}
                    <span className="text-sm font-normal text-muted">({step.count})</span>
                  </h2>
                  <p className="text-sm text-muted">{info.text}</p>
                </div>
                {step.unlocked ? (
                  <Link
                    to={info.to}
                    className="inline-flex h-11 shrink-0 items-center rounded-2xl border-[1.5px] border-border px-4 text-sm font-bold text-mid hover:border-primary hover:text-primary"
                  >
                    {info.action}
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-muted">
                    Өмнөх алхмыг дуусгана уу
                  </span>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </>
  );
}
