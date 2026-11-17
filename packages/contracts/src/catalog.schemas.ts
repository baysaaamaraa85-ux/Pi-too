import { z } from "zod";
import { moneySchema } from "./money.js";

// ФШ-07
export const createBranchSchema = z.object({
  name: z.string().min(1, "Нэр шаардлагатай"),
  address: z.string().min(1, "Хаяг шаардлагатай"),
  // ФШ-78: нийтийн сайтын "Салбарууд" хуудсанд харагдах дэлгэрэнгүй, холбоо барих утаснууд.
  description: z.string().trim().max(1000).nullable().optional(),
  phones: z.array(z.string().trim().min(3, "Утас богино байна").max(30)).max(6).optional(),
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

// D-67: protocolHourlyRate нь захирлын цалингийн протокол (жишиг цагийн үнэлгээ), зөвхөн тулгах лавлах.
export const updateProgramSchema = createProgramSchema
  .partial()
  .extend({ protocolHourlyRate: moneySchema.nullable().optional() });
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

// ФШ-09, ФБШ-29: нэг удаад нэг тохиргооны мөр.
export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.record(z.string(), z.unknown()),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
