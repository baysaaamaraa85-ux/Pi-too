import type {
  AdminDashboardDto,
  DashboardDto,
  DashboardLessonDto,
  TeacherDashboardDto,
} from "@pitoo/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

// ФШ-68, 70: нүүр хуудасны самбар. Ирц хадгалагдахад ["dashboard"]-ыг хүчингүй болгоно.
export const DASHBOARD_KEY = "dashboard";

export function useDashboard<T extends DashboardDto>(role: T["role"]) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, role],
    queryFn: () => api.get<T>("/dashboard"),
  });
}

export const useAdminDashboard = () => useDashboard<AdminDashboardDto>("ADMIN");
export const useTeacherDashboard = () => useDashboard<TeacherDashboardDto>("TEACHER");

export type { DashboardLessonDto };
