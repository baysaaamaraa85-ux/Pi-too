import { z } from "zod";

// ФШ-19. teacherId зөвхөн админ бичихэд хэрэгтэй, багш өөрийгөө л үүсгэнэ.
export const createClassSchema = z.object({
  teacherId: z.uuid().optional(),
  branchId: z.uuid(),
  weekday: z.number().int().min(1).max(7),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Цагийг "HH:MM" хэлбэрээр бичнэ'),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

// ФШ-20
export const enrollInClassSchema = z.object({
  contractId: z.uuid(),
  fromDate: z.iso.date(),
});
export type EnrollInClassInput = z.infer<typeof enrollInClassSchema>;

// ФШ-24, 25
export const rescheduleLessonSchema = z.object({
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
export type RescheduleLessonInput = z.infer<typeof rescheduleLessonSchema>;

// ФШ-23
export const listLessonsQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});
export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;

// ФШ-15: сул суудалтай ангийн хайлтын шүүлтүүр.
export const availableClassesQuerySchema = z.object({
  branchId: z.uuid().optional(),
  weekday: z.coerce.number().int().min(1).max(7).optional(),
  teacherId: z.uuid().optional(),
});

// D-69: багшийн долоо хоногийн хуваарь гаригаар: анги бүрийн цаг (эхлэх-дуусах), ачаалал (бүртгэлтэй/суудал).
export interface ClassWeekDto {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  durationMin: number;
  capacity: number;
  enrolled: number;
  branchId: string;
  branchName: string;
}

// Ангийн сурагчид (popup): төлбөрийн төлөв дүнгүй (ФШ-51).
export interface ClassRosterStudentDto {
  contractId: string;
  studentId: string;
  studentName: string;
  programName: string;
  paymentFlag: "FULL" | "DEBT";
  // Сурагчийн одоо бүртгэлтэй бүх ангийн id (нэг сурагч 2-4 ангид байдаг).
  classIds: string[];
}

export interface ClassRosterDto {
  classId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  branchName: string;
  capacity: number;
  students: ClassRosterStudentDto[];
}
