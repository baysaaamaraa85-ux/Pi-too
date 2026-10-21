import { z } from "zod";

// ФШ-12, 13: шинэ сурагчийн анкет. parentFullName зөвхөн шинэ эцэг эх
// бүртгэх үед шаардлагатай (ижил утастай эцэг эх байвал дахин ашиглана).
export const createStudentSchema = z.object({
  parentPhone: z.string().min(1, "Эцэг эхийн утас шаардлагатай"),
  parentFullName: z.string().min(1).optional(),
  studentFullName: z.string().min(1, "Сурагчийн нэр шаардлагатай"),
  school: z.string().optional(),
  grade: z.string().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// ФШ-14: түвшин тогтоох шалгалт.
export const createAssessmentSchema = z.object({
  contractId: z.uuid().optional(),
  takenOn: z.iso.date(),
  totalPercent: z.number().min(0).max(100),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

// ФШ-16, 17
export const createContractSchema = z.object({
  studentId: z.uuid(),
  programId: z.uuid(),
  rulesAckAt: z.iso.datetime(),
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
