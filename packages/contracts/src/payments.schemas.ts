import { z } from "zod";
import { pageQuerySchema } from "./common.schemas.js";
import { moneySchema } from "./money.js";

// М7 Төлбөр ба өр (ФШ-46...52, 76, 77). Банктай холболтгүй (ADR-016): эцэг эх шилжүүлж
// "Шилжүүлсэн" гэж мэдэгдээд, админ банкны хуулгаас олж бүртгэнэ.

export const PaymentChannel = {
  BANK_TRANSFER: "BANK_TRANSFER",
  CASH: "CASH",
  OTHER: "OTHER",
} as const;
export type PaymentChannel = (typeof PaymentChannel)[keyof typeof PaymentChannel];

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  BANK_TRANSFER: "Банкны шилжүүлэг",
  CASH: "Бэлнээр",
  OTHER: "Бусад",
};

// ФШ-47, 77: хадгалагдахгүй, тооцоологдох төлөв.
export const PaymentStatus = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  PENDING: "PENDING",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Төлөгдөөгүй",
  PARTIAL: "Дутуу төлөгдсөн",
  PAID: "Төлөгдсөн",
  PENDING: "Хүлээгдэж байна",
};

// ФШ-51: багшид зөвхөн дүнгүй төлөв.
export const TEACHER_PAYMENT_FLAG_LABELS = { FULL: "Бүрэн", DEBT: "Үлдэгдэлтэй" } as const;
export type TeacherPaymentFlag = keyof typeof TEACHER_PAYMENT_FLAG_LABELS;

const positiveMoney = moneySchema.refine((v) => Number(v) > 0, "Дүн 0-ээс их байх ёстой");

// ФШ-46: төлбөрийг гэрээ бүрээр дүн, огноо, суваг, гүйлгээний утгатай.
export const createPaymentSchema = z.object({
  amount: positiveMoney,
  paidAt: z.iso.date(),
  channel: z.enum(["BANK_TRANSFER", "CASH", "OTHER"]),
  reference: z.string().trim().max(300).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ФШ-52: засахад шалтгаан заавал, анхны утга аудитад хадгалагдана.
export const updatePaymentSchema = z.object({
  amount: positiveMoney.optional(),
  paidAt: z.iso.date().optional(),
  reference: z.string().trim().max(300).optional(),
  reason: z.string().trim().min(1, "Шалтгаан шаардлагатай").max(300),
});
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(1, "Шалтгаан шаардлагатай").max(300),
});
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;

// ФШ-76
export const createClaimSchema = z.object({ contractId: z.uuid() });
export type CreateClaimInput = z.infer<typeof createClaimSchema>;

export const rejectClaimSchema = z.object({
  reason: z.string().trim().min(1, "Татгалзсан шалтгаан шаардлагатай").max(300),
});
export type RejectClaimInput = z.infer<typeof rejectClaimSchema>;

export const debtsQuerySchema = pageQuerySchema.extend({
  branchId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
  // Гэрээ эхэлснээс хойш хоногоор (ФШ-48).
  sinceDays: z.coerce.number().int().min(0).max(3650).optional(),
});
export type DebtsQuery = z.infer<typeof debtsQuerySchema>;

export const paymentsQuerySchema = pageQuerySchema.extend({
  contractId: z.uuid().optional(),
  status: z.enum(["ACTIVE", "CANCELLED"]).optional(),
  search: z.string().trim().max(120).optional(),
});
export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;

export type BalanceDto = {
  contractId: string;
  price: string;
  paid: string;
  balance: string;
  status: PaymentStatus;
};

export type PaymentDto = {
  id: string;
  contractId: string;
  studentName: string;
  programName: string;
  amount: string;
  paidAt: string;
  channel: PaymentChannel;
  reference: string | null;
  status: "ACTIVE" | "CANCELLED";
  cancelReason: string | null;
  createdAt: string;
};

export type DebtRowDto = BalanceDto & {
  studentName: string;
  programName: string;
  branches: string[];
  teachers: string[];
  startedOn: string;
};

export type ClaimDto = {
  id: string;
  contractId: string;
  studentName: string;
  programName: string;
  parentName: string;
  parentPhone: string;
  balance: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  claimedAt: string;
  rejectReason: string | null;
};
