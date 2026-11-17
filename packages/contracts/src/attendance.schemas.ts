import { z } from "zod";

// ФШ-26, 27: клиент зөвхөн "ирсэн эсэх" илгээнэ, төлвийг сервер тооцно (ADR-007).
// reason: админ 24 цагаас хойш бүртгэхэд шалтгаан заавал бичнэ (ФШ-33, service-д шалгана).
// D-70: сурагч төлөвлөснөөс их, бага сууж болно. "Цаг нэмэгдсэн" үед хэдээс хэдэн цагийн хооронд суусныг
// (24 цагийн систем, Улаанбаатарын цаг) бичнэ: багцаас орсон цагаараа (минут / 40) хасагдаж, цалин бодогдоно.
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Цагийг "HH:MM" хэлбэрээр бичнэ');

export const putAttendanceSchema = z.object({
  entries: z
    .array(
      z
        .object({
          contractId: z.uuid(),
          present: z.boolean(),
          actualFrom: timeOfDay.optional(),
          actualTo: timeOfDay.optional(),
        })
        .refine((e) => (e.actualFrom === undefined) === (e.actualTo === undefined), {
          message: "Эхлэх, дуусах цагийг хоёуланг нь бичнэ үү",
          path: ["actualTo"],
        }),
    )
    .min(1, "Хамгийн багадаа нэг сурагчийн ирц шаардлагатай"),
  reason: z.string().trim().min(1).optional(),
});
export type PutAttendanceInput = z.infer<typeof putAttendanceSchema>;

// ФШ-33: админ шалтгаан заавал бичнэ (service-д шалгана, 24 цагийн дотор
// багш шалтгаангүйгээр засаж болно).
// actualFrom, actualTo: хоёуланг нь өгвөл бодит цаг шинэчлэгдэнэ, хоёулаа null бол төлөвлөсөн цаг руу буцна,
// өгөөгүй бол өмнөх утга хэвээр.
export const patchAttendanceSchema = z.object({
  present: z.boolean(),
  reason: z.string().trim().min(1).optional(),
  actualFrom: timeOfDay.nullable().optional(),
  actualTo: timeOfDay.nullable().optional(),
});
export type PatchAttendanceInput = z.infer<typeof patchAttendanceSchema>;

// ФШ-31
export const createMakeupSchema = z.object({
  contractId: z.uuid(),
  reason: z.string().trim().min(1).optional(),
  actualFrom: timeOfDay.optional(),
  actualTo: timeOfDay.optional(),
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
  // D-70: багц академик цагаар (жишээ нь 69 / 75).
  remainingHours: number;
  leavesLeft: number;
  totalHours: number;
  // ФШ-51: дүнгүй төлөв (М7 хийгдтэл null).
  paymentStatus: string | null;
  leaveRequested: boolean;
  isMakeup: boolean;
  // Бүртгэгдсэн бол: attendance.id, сервер тооцсон төлөв, тэмдэглэсэн утга.
  attendanceId: string | null;
  status: string | null;
  present: boolean | null;
  // D-70: бодит орсон цаг ("HH:MM", хоосон бол төлөвлөсөн цаг) ба энэ ирцээр багцаас хасагдсан академик цаг.
  actualFrom: string | null;
  actualTo: string | null;
  packageHours: number | null;
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
  // D-70: нэг академик цагийн минут (settings, анхдагч 40). Бодит цагийн урьдчилсан тооцоонд.
  academicHourMinutes: number;
  windowOpen: boolean;
  started: boolean;
  rows: AttendanceRowDto[];
}
