import { z } from "zod";
import { moneySchema } from "./money.js";

// ФШ-07
export const createBranchSchema = z.object({
  name: z.string().min(1, "Нэр шаардлагатай"),
  address: z.string().min(1, "Хаяг шаардлагатай"),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

// ФШ-08
export const createProgramSchema = z.object({
  name: z.string().min(1, "Нэр шаардлагатай"),
  currentPrice: moneySchema,
});
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

export const updateProgramSchema = createProgramSchema.partial();
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

// ФШ-10
export const createTeacherRateSchema = z.object({
  hourlyRate: moneySchema,
  effectiveFrom: z.iso.date("Огноог YYYY-MM-DD хэлбэрээр бичнэ"),
});
export type CreateTeacherRateInput = z.infer<typeof createTeacherRateSchema>;

// ФШ-09, ФБШ-29: нэг удаад нэг тохиргооны мөр.
export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
