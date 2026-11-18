import { z } from "zod";
import { pageQuerySchema, phoneSchema } from "./common.schemas.js";

// ФШ-12, 13: шинэ сурагчийн анкет. parentFullName зөвхөн шинэ эцэг эх
// бүртгэх үед шаардлагатай (ижил утастай эцэг эх байвал дахин ашиглана).
export const createStudentSchema = z.object({
  parentPhone: z.string().min(1, "Эцэг эхийн утас шаардлагатай"),
  parentFullName: z.string().min(1).optional(),
  studentFullName: z.string().min(1, "Сурагчийн нэр шаардлагатай"),
  // Сонголттой: утас заавал биш. Өгвөл сурагч өөрөө нэвтрэх данс авна.
  studentPhone: z.string().min(1).optional(),
  school: z.string().optional(),
  grade: z.string().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// ФШ-16, 17. D-82: журамтай танилцсан огноо, цагийг СЕРВЕР өөрийн цагаар бүртгэнэ (клиент цаг илгээхгүй, хуурч болохгүй).
// Клиент зөвхөн эцэг эх танилцсаныг баталгаажуулна: үгүй бол гэрээ хадгалагдахгүй (422).
export const createContractSchema = z.object({
  studentId: z.uuid(),
  programId: z.uuid(),
  rulesAcknowledged: z.literal(true, { error: "Эцэг эх журамтай танилцсаныг баталгаажуулна уу" }),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

// ФШ-18
export const updateContractPlanSchema = z.object({
  items: z.array(
    z.object({ position: z.number().int().positive(), topic: z.string().min(1) }),
  ),
});
export type UpdateContractPlanInput = z.infer<typeof updateContractPlanSchema>;

// ФШ-72
export const pauseContractSchema = z.object({
  startedOn: z.iso.date(),
  reason: z.string().min(1, "Шалтгаан шаардлагатай"),
  holdSeat: z.boolean(),
});
export type PauseContractInput = z.infer<typeof pauseContractSchema>;

// ФШ-75: classIds зөвхөн суудал хадгалаагүй үед шаардлагатай (service-д шалгана).
export const resumeContractSchema = z.object({
  resumedOn: z.iso.date(),
  classIds: z.array(z.uuid()).optional(),
});
export type ResumeContractInput = z.infer<typeof resumeContractSchema>;

// Шинэ шаардлага 1.4: сурагч, эцэг эх, гэрээ, ангийн бүртгэлийг НЭГ транзакцаар.
// ФШ-12, 13, 16, 17, 20, ФБШ-23 (зөвшөөрлийн огноо). weeklyWarningAcknowledged:
// ФШ-22 анхааруулгыг хэрэглэгч харж, онцгой тохиолдлоор хадгалахыг баталсан.
export const enrollStudentSchema = z.object({
  parentPhone: phoneSchema,
  parentFullName: z.string().trim().min(1).optional(),
  studentFullName: z.string().trim().min(1, "Сурагчийн нэр шаардлагатай"),
  studentPhone: phoneSchema.optional(),
  school: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  placementPercent: z.number().min(0).max(100).optional(),
  programId: z.uuid(),
  classIds: z.array(z.uuid()).min(1, "Дор хаяж нэг анги сонгоно").max(7),
  fromDate: z.iso.date(),
  // D-82: журамтай танилцсан, хувийн мэдээлэл боловсруулахыг зөвшөөрсөн огноо, цагийг сервер бүртгэнэ.
  rulesAcknowledged: z.literal(true, { error: "Эцэг эх журамтай танилцсаныг баталгаажуулна уу" }),
  consentGiven: z.literal(true, { error: "Хувийн мэдээлэл боловсруулахыг зөвшөөрснийг баталгаажуулна уу" }),
  weeklyWarningAcknowledged: z.boolean().optional(),
});
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;

export const listContractsQuerySchema = pageQuerySchema.extend({
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  search: z.string().trim().max(120).optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
