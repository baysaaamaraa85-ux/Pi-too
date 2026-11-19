import { z } from "zod";
import { moneySchema } from "./money.js";
import { pageQuerySchema } from "./common.schemas.js";

// Шинэ шаардлага 1.6, ФШ-55...59: багшийн цалингийн журнал.
export const LedgerType = {
  EARNING: "EARNING",
  ADJUSTMENT: "ADJUSTMENT",
  PAYOUT: "PAYOUT",
} as const;
export type LedgerType = (typeof LedgerType)[keyof typeof LedgerType];

export const LEDGER_TYPE_LABELS: Record<LedgerType, string> = {
  EARNING: "Цалин",
  ADJUSTMENT: "Залруулга",
  PAYOUT: "Олголт",
};

const dateKey = z.iso.date();

export const ledgerQuerySchema = pageQuerySchema.extend({
  teacherId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  type: z.enum(["EARNING", "ADJUSTMENT", "PAYOUT"]).optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
});
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;

export const payrollSummaryQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
});

// ФШ-55: админ багшид олгосон мөнгийг (цалин, урьдчилгаа ялгаагүй) бүртгэнэ.
// confirm: ФБШ-31 үлдэгдлээс их эсвэл ирц бөглөгдөөгүй хичээлтэй үед давтан баталгаажуулалт.
export const createPayoutSchema = z.object({
  teacherId: z.uuid(),
  amount: moneySchema.refine((v) => Number(v) > 0, "Олголтын дүн 0-ээс их байх ёстой"),
  note: z.string().trim().max(300).optional(),
  confirm: z.boolean().optional(),
});
export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;

export const exportQuerySchema = z.object({
  format: z.enum(["xlsx", "pdf"]),
  teacherId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  type: z.enum(["EARNING", "ADJUSTMENT", "PAYOUT"]).optional(),
  from: dateKey.optional(),
  to: dateKey.optional(),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;

export interface LedgerRowDto {
  id: string;
  type: LedgerType;
  // Хичээлийн огноо (EARNING, ADJUSTMENT) эсвэл олголтын огноо.
  date: string;
  createdAt: string;
  teacherId: string;
  teacherName: string;
  branchName: string | null;
  classLabel: string | null;
  lessonId: string | null;
  studentName: string | null;
  attendanceStatus: string | null;
  rateUsed: string | null;
  durationHours: string | null;
  amount: string;
  note: string | null;
}

export interface LedgerSummaryDto {
  earned: string;
  paid: string;
  // ФШ-57: тасралтгүй үлдэгдэл = нийт олсон - нийт олгосон (бүх хугацаагаар).
  balance: string;
}

// D-67, D-68 (ФШ-10, 53 шинэчлэл): багш хүүхэд (гэрээ) тус бүр дээрээ өөрийн цагийн цалинг гараар оруулна.
// Хэзээ ч засаж болно, засвар тухайн хүүхдийн бүх хичээлийн (өмнөх ба дараах) цалинд үйлчилнэ: зөрүүг
// ADJUSTMENT мөрөөр бичнэ (ADR-010).
export const setContractRateSchema = z.object({
  hourlyRate: moneySchema,
});
export type SetContractRateInput = z.infer<typeof setContractRateSchema>;

// D-99: багш бүх идэвхтэй хүүхдийнхээ цагийн цалинг нэг дор оруулж хадгална (нэг транзакц: нэг нь алдвал бүгд буцна).
// Давхардсан гэрээ орвуулж болохгүй (сүүлийнх нь нууцаар давамгайлахаас сэргийлнэ).
export const MAX_BULK_RATES = 200;
export const setContractRatesSchema = z.object({
  rates: z
    .array(z.object({ contractId: z.uuid(), hourlyRate: moneySchema }))
    .min(1, "Хадгалах цагийн цалин алга")
    .max(MAX_BULK_RATES)
    .refine((rows) => new Set(rows.map((r) => r.contractId)).size === rows.length, "Нэг хүүхдийг давтан оруулах боломжгүй"),
});
export type SetContractRatesInput = z.infer<typeof setContractRatesSchema>;
export interface SetContractRatesResultDto {
  // Бодитоор өөрчлөгдсөн (өмнөхөөсөө өөр) хүүхдийн тоо.
  updated: number;
  // Нөхөн бодогдсон өмнөх хичээлийн (ирцийн) тоо.
  adjusted: number;
}

// D-67: ах дүүгийн хөнгөлөлтийн хувь, "10.00" хэлбэр (0.00-100.00).
export const discountPercentSchema = z
  .string()
  .regex(/^\d{1,3}\.\d{2}$/, 'Хувийг "10.00" хэлбэрээр бичнэ')
  .refine((v) => Number(v) <= 100, "Хувь 100-аас их байж болохгүй");
export const setContractDiscountSchema = z.object({
  percent: discountPercentSchema,
});
export type SetContractDiscountInput = z.infer<typeof setContractDiscountSchema>;

// Багшийн өөрийн сурагч бүрийн үнэлгээ (хөтөлбөрийн протоколыг багшид харуулахгүй).
export interface TeacherContractRateDto {
  contractId: string;
  studentId: string;
  studentName: string;
  programName: string;
  // Багшийн оруулсан одоогийн үнэлгээ, оруулаагүй бол null.
  hourlyRate: string | null;
  // Ах дүүгийн хөнгөлөлт: цалин энэ хувиар буурна.
  discountPercent: string;
  // Хөнгөлөлт хэрэглэсний дараах бодит цагийн үнэлгээ.
  effectiveRate: string | null;
}

// Захирлын протокол: үнэлгээг багш, хүүхдээр нь протоколтой тулгана.
export type RateCheckStatus = "MATCH" | "DIFFERENT" | "MISSING" | "NO_PROTOCOL";
export const RATE_CHECK_LABELS: Record<RateCheckStatus, string> = {
  MATCH: "Таарсан",
  DIFFERENT: "Зөрсөн",
  MISSING: "Оруулаагүй",
  NO_PROTOCOL: "Протоколгүй",
};

export interface RateProtocolRowDto {
  teacherId: string;
  teacherName: string;
  contractId: string;
  studentName: string;
  programId: string;
  programName: string;
  protocolRate: string | null;
  enteredRate: string | null;
  discountPercent: string;
  status: RateCheckStatus;
}

export interface RateProtocolDto {
  programs: { id: string; name: string; protocolRate: string | null }[];
  rows: RateProtocolRowDto[];
}

export const rateProtocolQuerySchema = z.object({
  teacherId: z.uuid().optional(),
  programId: z.uuid().optional(),
  status: z.enum(["MATCH", "DIFFERENT", "MISSING", "NO_PROTOCOL"]).optional(),
});

// D-68: багшийн "Миний цалин" хуудас сурагч (гэрээ) бүрээр. Хугацаа хоосон бол бүх хугацаа.
export const myStudentsPayrollQuerySchema = z.object({
  from: dateKey.optional(),
  to: dateKey.optional(),
});
export type MyStudentsPayrollQuery = z.infer<typeof myStudentsPayrollQuerySchema>;

export interface StudentPayrollRowDto {
  contractId: string;
  studentId: string;
  studentName: string;
  programName: string;
  // D-73: багц дууссан (COMPLETED) бол "Амжилттай дууссан сурагчид" хэсэгт гарна.
  contractStatus: "ACTIVE" | "PAUSED" | "COMPLETED";
  // Багцын академик цаг (ирэлтийн тоо x нэг ирэлтийн академик цаг), жишээ нь 75.
  academicHoursExpected: string;
  // Энэ багшийн заасан, цалинд тооцогдсон академик цаг (минут / нэг академик цагийн минут).
  academicHoursDone: string;
  // Цалингийн цаг: цалинд тооцогдсон хичээлийн 60 минутын цаг.
  payrollHours: string;
  // Багшийн гараар оруулсан цагийн цалин, оруулаагүй бол null.
  hourlyRate: string | null;
  // Ах дүүгийн хөнгөлөлтийн хувь ба хөнгөлсний дараах цагийн цалин.
  discountPercent: string;
  effectiveRate: string | null;
  // Авах цалин = цалингийн цаг x цагийн цалин (хугацаанд).
  earned: string;
  // Төлбөрийн төлөв: багшид дүнгүй (ФШ-51).
  paymentFlag: "FULL" | "DEBT";
  // Сүүлд эцэг эхэд төлбөрийн сануулга илгээсэн огноо.
  lastReminderAt: string | null;
}

export interface MyStudentsPayrollDto {
  rows: StudentPayrollRowDto[];
  totalEarned: string;
}

export interface StudentPayrollEntryDto {
  attendanceId: string;
  startsAt: string;
  date: string;
  classLabel: string;
  branchName: string;
  durationMin: number;
  academicHours: string;
  payrollHours: string;
  status: string;
  counted: boolean;
  // Энэ ирцэд бодогдсон цагийн цалин (хөнгөлсөн) ба нийт дүн (EARNING + ADJUSTMENT).
  rateUsed: string | null;
  amount: string;
}
