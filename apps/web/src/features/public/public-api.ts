import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api-client/client";

// ФШ-78: нийтийн сайтын өгөгдөл өгөгдлийн сангаас (багш, хөтөлбөр, үнэ, салбар, журмын гол тоо).
export interface PublicTeacher {
  id: string;
  fullName: string;
  specialties: string[];
  photoUrl: string | null;
  branches: string[];
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string;
  description: string | null;
  phones: string[];
  photoUrl: string | null;
}

export interface PublicProgram {
  id: string;
  name: string;
  price: string;
}

export interface PublicOverview {
  branchCount: number;
  classCapacity: number;
  packageHours: number;
  leaves: number;
  reviewThresholdPercent: number;
}

const STALE = 60_000;

export const usePublicTeachers = () =>
  useQuery({ queryKey: ["public", "teachers"], staleTime: STALE, queryFn: () => api.get<PublicTeacher[]>("/public/teachers") });

export const usePublicBranches = () =>
  useQuery({ queryKey: ["public", "branches"], staleTime: STALE, queryFn: () => api.get<PublicBranch[]>("/public/branches") });

export const usePublicPrograms = () =>
  useQuery({ queryKey: ["public", "programs"], staleTime: STALE, queryFn: () => api.get<PublicProgram[]>("/public/programs") });

export const usePublicOverview = () =>
  useQuery({ queryKey: ["public", "overview"], staleTime: STALE, queryFn: () => api.get<PublicOverview>("/public/overview") });

// Нэвтэрсэн багшийн өөрийн нийтийн профайл (зураг, мэргэшил). Нийтийн жагсаалтаас id-аар олно: тусдаа endpoint шаардахгүй.
export function useOwnTeacherProfile(userId: string | undefined) {
  const { data } = usePublicTeachers();
  return userId ? data?.find((t) => t.id === userId) : undefined;
}

// Багшийн картын өгөгдөл: DB-ийн жагсаалт. DB-д багш огт байхгүй (шинэ систем) үед л маркетингийн жишээ харуулна.
export interface TeacherCardData {
  name: string;
  branch: string;
  specialties: string[];
  photo?: string;
}

export function toCardData(t: PublicTeacher): TeacherCardData {
  return {
    name: t.fullName,
    branch: t.branches.join(", "),
    specialties: t.specialties,
    photo: t.photoUrl ?? undefined,
  };
}
