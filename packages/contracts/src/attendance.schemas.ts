import { z } from "zod";

// ФШ-26, 27: клиент зөвхөн "ирсэн эсэх" илгээнэ, төлвийг сервер тооцно (ADR-007).
export const putAttendanceSchema = z.object({
  entries: z
    .array(z.object({ contractId: z.uuid(), present: z.boolean() }))
    .min(1, "Хамгийн багадаа нэг сурагчийн ирц шаардлагатай"),
});
export type PutAttendanceInput = z.infer<typeof putAttendanceSchema>;

// ФШ-33: админ шалтгаан заавал бичнэ (service-д шалгана, 24 цагийн дотор
// багш шалтгаангүйгээр засаж болно).
export const patchAttendanceSchema = z.object({
  present: z.boolean(),
  reason: z.string().min(1).optional(),
});
export type PatchAttendanceInput = z.infer<typeof patchAttendanceSchema>;

// ФШ-31
export const createMakeupSchema = z.object({
  contractId: z.uuid(),
});
export type CreateMakeupInput = z.infer<typeof createMakeupSchema>;

// ФШ-30
export const createLeaveRequestSchema = z.object({
  contractId: z.uuid(),
  lessonId: z.uuid(),
});
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
