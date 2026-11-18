import type { LessonStatus } from "@pitoo/contracts";

// API-ийн хариуны хэлбэрүүд (Prisma-ийн Decimal нь тэмдэгт мөр, огноо ISO тэмдэгт мөр).
export interface LessonDto {
  id: string;
  classId: string;
  teacherId: string;
  startsAt: string;
  endsAt: string;
  status: LessonStatus;
  originalStartsAt: string;
}

export interface BranchDto {
  id: string;
  name: string;
  address: string;
  description: string | null;
  phones: string[];
  photoUrl: string | null;
  isActive: boolean;
}

export interface ProgramDto {
  id: string;
  name: string;
  currentPrice: string;
}

export interface ClassDto {
  id: string;
  teacherId: string;
  branchId: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  capacity: number;
  isActive: boolean;
}

export interface AvailableClassDto extends ClassDto {
  availableSeats: number;
  branchName: string;
  teacherName: string;
}

export interface SettingDto {
  key: string;
  value: Record<string, unknown>;
}

export interface PlacementRequestDto {
  id: string;
  studentName: string;
  school: string | null;
  grade: string | null;
  phone: string;
  programInterest: string | null;
  status: "NEW" | "CONTACTED" | "SCHEDULED" | "DONE" | "CANCELLED";
  note: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
}

export interface ParentDto {
  userId: string;
  fullName: string;
  phone: string;
}
