import { z } from "zod";

// ФШ-26, 27: клиент зөвхөн "ирсэн эсэх" илгээнэ, төлвийг сервер тооцно (ADR-007).
// reason: админ 24 цагаас хойш бүртгэхэд шалтгаан заавал бичнэ (ФШ-33, service-д шалгана).
export const putAttendanceSchema = z.object({
  entries: z
    .array(z.object({ contractId: z.uuid(), present: z.boolean() }))
    .min(1, "Хамгийн багадаа нэг сурагчийн ирц шаардлагатай"),
  reason: z.string().trim().min(1).optional(),
});
export type PutAttendanceInput = z.infer<typeof putAttendanceSchema>;

// ФШ-33: админ шалтгаан заавал бичнэ (service-д шалгана, 24 цагийн дотор
// багш шалтгаангүйгээр засаж болно).
export const patchAttendanceSchema = z.object({
  present: z.boolean(),
  reason: z.string().trim().min(1).optional(),
});
export type PatchAttendanceInput = z.infer<typeof patchAttendanceSchema>;

// ФШ-31
export const createMakeupSchema = z.object({
  contractId: z.uuid(),
  reason: z.string().trim().min(1).optional(),
});
export type CreateMakeupInput = z.infer<typeof createMakeupSchema>;

// ФШ-30
export const createLeaveRequestSchema = z.object({
  contractId: z.uuid(),
  lessonId: z.uuid(),
});
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

// Ирцийн дэлгэц (ФШ-27, ФБШ-08): хичээлийн сурагч бүрийн мөр.
export interface AttendanceRowDto {
  contractId: string;
  studentId: string;
  studentName: string;
  programName: string;
  remainingVisits: number;
  leavesLeft: number;
  totalVisits: number;
  // ФШ-51: дүнгүй төлөв (М7 хийгдтэл null).
  paymentStatus: string | null;
  leaveRequested: boolean;
  isMakeup: boolean;
  // Бүртгэгдсэн бол: attendance.id, сервер тооцсон төлөв, тэмдэглэсэн утга.
  attendanceId: string | null;
  status: string | null;
  present: boolean | null;
}

export interface AttendanceSheetDto {
  lesson: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    branchName: string;
    teacherName: string;
    capacity: number;
  };
  // Багш: хичээл дууссанаас хойш 24 цаг хүртэл. null бол хугацааны хязгааргүй (админ).
  editableUntil: string;
  windowOpen: boolean;
  started: boolean;
  rows: AttendanceRowDto[];
}
