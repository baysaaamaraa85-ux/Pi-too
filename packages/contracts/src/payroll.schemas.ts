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
