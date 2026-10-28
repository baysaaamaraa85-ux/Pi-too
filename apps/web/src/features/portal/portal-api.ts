import type { AttendanceStatus, ContractStatus } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

// Backend-ийн /portal/* хариуны хэлбэрүүд (design 5.4, М10).
export interface PortalClass {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  teacherName: string;
  branchName: string;
}

export interface PortalContract {
  id: string;
  programName: string;
  status: ContractStatus;
  totalVisits: number;
  remainingVisits: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  classes: PortalClass[];
}

export interface PortalStudent {
  studentId: string;
  fullName: string;
  school: string | null;
  grade: string | null;
  contracts: PortalContract[];
}

export interface AttendanceRecord {
  id: string;
  lessonId: string;
  startsAt: string;
  programName: string;
  status: AttendanceStatus;
  isMakeup: boolean;
}

export interface AttendanceOverview {
  records: AttendanceRecord[];
  leaveRequests: { lessonId: string; contractId: string }[];
}

export interface PaymentInstructions {
  contractId: string;
  studentName: string;
  programName: string;
  price: string;
  account: { bankName: string; accountHolder: string; accountNumber: string; iban?: string };
  transferNote: string;
}

export function usePortalSummary() {
  return useQuery({
    queryKey: ["portal", "summary"],
    queryFn: () => api.get<{ students: PortalStudent[] }>("/portal/summary"),
  });
}

export function useAttendanceOverview(studentId: string | undefined) {
  return useQuery({
    queryKey: ["portal", "attendance", studentId],
    enabled: Boolean(studentId),
    queryFn: () => api.get<AttendanceOverview>(`/portal/students/${studentId}/attendance`),
  });
}

export function usePaymentInstructions(contractId: string | null) {
  return useQuery({
    queryKey: ["portal", "payment", contractId],
    enabled: Boolean(contractId),
    queryFn: () =>
      api.get<PaymentInstructions>(`/portal/contracts/${contractId}/payment-instructions`),
  });
}

// ФШ-30: хичээл эхлэхээс өмнө чөлөө хүсэх.
export function useRequestLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { contractId: string; lessonId: string }) =>
      api.post("/leave-requests", input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["portal", "attendance"] }),
  });
}

// Сонгосон хүүхдийн ангиудын id-ууд, ангийн id-аар гэрээг олох зураглал.
export function contractByClassId(student: PortalStudent | undefined) {
  const map = new Map<string, PortalContract>();
  for (const contract of student?.contracts ?? []) {
    for (const cls of contract.classes) map.set(cls.id, contract);
  }
  return map;
}
