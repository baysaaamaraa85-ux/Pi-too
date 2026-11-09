import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";
import type { BranchDto, ClassDto } from "@/shared/api-client/types";
import { weekdayName } from "@/shared/format/date";
import { TeacherHome } from "@/features/dashboard/teacher-home";

export function useTeacherClasses(teacherId: string) {
  const classes = useQuery({
    queryKey: ["classes", teacherId],
    queryFn: () => api.get<ClassDto[]>(`/classes?teacherId=${teacherId}`),
  });
  const branches = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<BranchDto[]>("/branches"),
  });
  return { classes, branches };
}

export function classLabel(
  cls: ClassDto | undefined,
  branches: BranchDto[] | undefined,
): string | undefined {
  if (!cls) return undefined;
  const branch = branches?.find((b) => b.id === cls.branchId)?.name;
  return `${branch ?? "Салбар"} · ${weekdayName(cls.weekday)} ${cls.startTime}`;
}

// Багшийн нүүр: мэндчилгээ, үзүүлэлт, өнөөдрийн хичээл, ахиц (features/dashboard/teacher-home.tsx).
export function TeacherTodayPage() {
  return <TeacherHome />;
}
