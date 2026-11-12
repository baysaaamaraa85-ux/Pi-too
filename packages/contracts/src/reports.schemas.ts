import { z } from "zod";
import { pageQuerySchema } from "./common.schemas.js";

// ФШ-69: сарын тайлан. month = "ОООО-СС".
export const monthlyReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Сар ОООО-СС хэлбэртэй байх ёстой"),
});
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export type MonthlyReportRowDto = {
  // null бол салбарт хамаарахгүй мөр ("Салбаргүй").
  branchId: string | null;
  branchName: string;
  activeStudents: number;
  attendanceTotal: number;
  attendanceAttended: number;
  // Ирсэн / нийт, нэг оронтой хувь ("92.9"). Ирц байхгүй бол null.
  attendancePercent: string | null;
  paymentsReceived: string;
  totalDebt: string;
  payrollCost: string;
  completedContracts: number;
  continuedContracts: number;
  continuationPercent: string | null;
};

export type MonthlyReportDto = {
  month: string;
  branches: MonthlyReportRowDto[];
  total: MonthlyReportRowDto;
};

// ФШ-68, 70: нүүр хуудасны самбар. Үүргээс хамаарч хэлбэр өөр.
export type DashboardLessonDto = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  branchName: string;
  teacherName: string;
  expected: number;
  recorded: number;
};

export type TeacherTaskDto = {
  id: string;
  type: "EXAM" | "MEETING";
  dueOn: string;
  contractId: string;
  studentId: string;
  studentName: string;
  programName: string;
};

export type AdminDashboardDto = {
  role: "ADMIN";
  debts: { count: number; totalDebt: string };
  negativeTeachers: { count: number; totalNegative: string };
};

export type TeacherStatsDto = {
  // Багшийн идэвхтэй гэрээтэй, одоо ангид бүртгэлтэй өвөрмөц сурагч.
  students: number;
  // Энэ сарын (Улаанбаатар) цуцлагдаагүй хичээл.
  lessonsThisMonth: number;
  // Энэ сарын ирцийн хувь: (Ирсэн + Нөхөлт + Үнэгүй давтлага) / нийт ирцийн мөр. Мөр байхгүй бол null.
  attendancePercent: string | null;
};

// Өдөр бүрийн дундаж дүн (Улаанбаатарын огноо). count нь тэр өдрийн сорилын тоо: клиент 7 хоног, 1 сар,
// 3 сараар нэгтгэхдээ жигнэсэн дундаж тооцоход хэрэглэнэ.
export type TeacherProgressPointDto = { date: string; averagePercent: string; count: number };

// Багш сурагчдаа хөтөлбөрөөр (категориор) хуваасан байдал: хөтөлбөр бүрийн идэвхтэй сурагчийн тоо.
export type TeacherCategoryDto = { programId: string; name: string; students: number };

export type TeacherDashboardDto = {
  role: "TEACHER";
  teacherName: string;
  stats: TeacherStatsDto;
  // Сүүлийн 92 хоногийн сорил, шалгалтын өдөр тутмын дундаж дүн (багшийн сурагчдын).
  progress: TeacherProgressPointDto[];
  categories: TeacherCategoryDto[];
  todayLessons: DashboardLessonDto[];
  unfilledLessons: DashboardLessonDto[];
  tasks: TeacherTaskDto[];
};

export type DashboardDto = AdminDashboardDto | TeacherDashboardDto;

// Аудитын бүртгэл (админ унших): шүүлт ба хуудаслалт.
export const auditQuerySchema = pageQuerySchema.extend({
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(60).optional(),
  // Хийсэн хүний утас эсвэл имэйл.
  actor: z.string().trim().max(120).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export type AuditEntryDto = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  actor: string;
  createdAt: string;
};

// ФШ-71: сурагчийн гэрээг өөр анги (салбар, багш) руу шилжүүлэх.
export const transferContractSchema = z.object({
  // Гэрээ нь 2-4 ангид бүртгэлтэй байж болох тул аль ангиас гарахыг заана.
  fromClassId: z.uuid(),
  toClassId: z.uuid(),
  // Шинэ анги эхлэх огноо (ОООО-СС-ӨӨ). Хуучин анги энэ өдрөөс өмнө хаагдана.
  effectiveFrom: z.iso.date(),
  reason: z.string().trim().min(1, "Шалтгаан шаардлагатай").max(500),
});
export type TransferContractInput = z.infer<typeof transferContractSchema>;

export type TransferResultDto = {
  contractId: string;
  fromClassId: string;
  toClassId: string;
  effectiveFrom: string;
  remainingVisits: number;
  leavesLeft: number;
};
