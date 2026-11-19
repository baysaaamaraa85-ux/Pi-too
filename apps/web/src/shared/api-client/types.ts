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
  // D-102: салбарын ахлагч багш (түвшин тогтоох хүсэлт түүнд очно), томилоогүй бол null.
  leadTeacher: { id: string; fullName: string } | null;
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

// D-102: хүсэлтийн хэлбэр contracts-д (админ ба багшийн хуудас хоёулаа ижил), хариуцагч багш (assignedTeacher) орсон.
export type { PlacementRequestDto } from "@pitoo/contracts";

export interface ParentDto {
  userId: string;
  fullName: string;
  phone: string;
}
