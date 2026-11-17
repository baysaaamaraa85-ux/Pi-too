import type { ContractStatus, Paginated, PaymentStatus } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

export interface ClassLabel {
  id: string;
  branchId: string;
  branchName: string;
  weekday: number;
  startTime: string;
  teacherId: string;
  teacherName: string;
}

export interface ContractSummary {
  id: string;
  programName: string;
  price: string;
  discountPercent: string;
  listPrice: string | null;
  status: ContractStatus;
  totalHours: number;
  remainingHours: number;
  leavesLeft: number;
  freeReviewsLeft: number;
  meetingsCount: number;
  paid: string | null;
  balance: string | null;
  paymentStatus: PaymentStatus | null;
  createdAt: string;
  classes: ClassLabel[];
}

export interface TeacherRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  activeClasses: number;
  branches: { id: string; name: string }[];
}

export interface TeacherDetail {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  // Нийтийн сайтад харагдах мэргэшил, зураг (ФШ-78).
  specialties: string[];
  photoUrl: string | null;
  balance: string;
  classes: {
    id: string;
    branchName: string;
    weekday: number;
    startTime: string;
    capacity: number;
    students: number;
  }[];
}

export interface ParentRow {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  children: { id: string; fullName: string }[];
}

export interface ParentDetail {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  children: {
    id: string;
    fullName: string;
    grade: string | null;
    school: string | null;
    contracts: ContractSummary[];
  }[];
}

export interface StudentRow {
  id: string;
  fullName: string;
  grade: string | null;
  school: string | null;
  accountId: string | null;
  accountPhone: string | null;
  accountActive: boolean | null;
  parents: { id: string; fullName: string; phone: string }[];
  contract: ContractSummary | null;
  contractCount: number;
}

export interface StudentDetail {
  id: string;
  fullName: string;
  grade: string | null;
  school: string | null;
  consentAt: string | null;
  accountId: string | null;
  accountPhone: string | null;
  accountActive: boolean | null;
  parents: { id: string; fullName: string; phone: string }[];
  contracts: ContractSummary[];
  assessments: { id: string; type: string; takenOn: string; totalPercent: string }[];
  attendance: { id: string; status: string; startsAt: string; branchName: string }[];
}

export interface Credentials {
  id: string;
  identifier: string;
  tempPassword: string;
}

export type ListFilters = {
  search: string;
  branchId: string;
  status: string;
  page: number;
};

function query(filters: ListFilters, limit = 20): string {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(limit) });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

export function useTeachers(filters: ListFilters) {
  return useQuery({
    queryKey: ["teachers", filters],
    queryFn: () => api.get<Paginated<TeacherRow>>(`/teachers?${query(filters)}`),
  });
}
export function useParents(filters: ListFilters) {
  return useQuery({
    queryKey: ["parents", filters],
    queryFn: () => api.get<Paginated<ParentRow>>(`/parents?${query(filters)}`),
  });
}
export function useStudents(filters: ListFilters) {
  return useQuery({
    queryKey: ["students", filters],
    queryFn: () => api.get<Paginated<StudentRow>>(`/students?${query(filters)}`),
  });
}
export function useTeacher(id: string) {
  return useQuery({ queryKey: ["teacher", id], queryFn: () => api.get<TeacherDetail>(`/teachers/${id}`) });
}
export function useParent(id: string) {
  return useQuery({ queryKey: ["parent", id], queryFn: () => api.get<ParentDetail>(`/parents/${id}`) });
}
export function useStudent(id: string) {
  return useQuery({ queryKey: ["student", id], queryFn: () => api.get<StudentDetail>(`/students/${id}`) });
}

// Үүсгэх, засах, идэвхгүй болгох бүрийн дараа холбогдох жагсаалт, дэлгэрэнгүйг шинэчилнэ
// (хуудас дахин ачаалахгүйгээр харагдана).
export function useInvalidateDirectory() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["teachers", "teacher", "parents", "parent", "students", "student"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

export function useSetUserActive() {
  const invalidate = useInvalidateDirectory();
  return useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) =>
      api.patch(`/users/${v.userId}/status`, { isActive: v.isActive }),
    onSuccess: invalidate,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (userId: string) => api.post<Credentials>(`/users/${userId}/reset-password`),
  });
}
