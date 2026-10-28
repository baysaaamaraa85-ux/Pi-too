import { z } from "zod";
import { pageQuerySchema, phoneSchema } from "./common.schemas.js";

// Админы "Багш нар", "Сурагчид", "Эцэг эхчүүд" жагсаалтын хайлт, шүүлт (шинэ шаардлага 1.2).
const searchField = z.string().trim().max(120).optional();

// Багш, эцэг эхийн төлөв: дансны идэвхтэй эсэх (ФШ-06).
export const userStatusFilter = z.enum(["active", "inactive"]);

export const listTeachersQuerySchema = pageQuerySchema.extend({
  search: searchField,
  branchId: z.uuid().optional(),
  status: userStatusFilter.optional(),
});
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;

export const listParentsQuerySchema = listTeachersQuerySchema;
export type ListParentsQuery = z.infer<typeof listParentsQuerySchema>;

// Сурагчийн төлөв: сүүлийн гэрээний төлөв (NONE = гэрээгүй).
export const studentStatusFilter = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "NONE"]);
export const listStudentsQuerySchema = pageQuerySchema.extend({
  search: searchField,
  branchId: z.uuid().optional(),
  status: studentStatusFilter.optional(),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

// Маягтын хоосон имэйл талбар алдаа биш: үүсгэхэд "өгөөгүй", засахад "арилгах" гэсэн утгатай.
const emailOnCreate = z
  .union([z.literal("").transform(() => undefined), z.email("Зөв имэйл хаяг оруулна уу")])
  .optional();
const emailOnUpdate = z
  .union([z.literal("").transform(() => null), z.email("Зөв имэйл хаяг оруулна уу"), z.null()])
  .optional();

// ФШ-02, 03: багш, эцэг эх үүсгэх. Нэвтрэх нэр нь утас.
export const createTeacherSchema = z.object({
  fullName: z.string().trim().min(1, "Нэр шаардлагатай").max(120),
  phone: phoneSchema,
  email: emailOnCreate,
});
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const createParentSchema = createTeacherSchema;
export type CreateParentInput = z.infer<typeof createParentSchema>;

export const updateTeacherSchema = z.object({
  fullName: z.string().trim().min(1, "Нэр шаардлагатай").max(120).optional(),
  phone: phoneSchema.optional(),
  email: emailOnUpdate,
});
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

export const updateParentSchema = updateTeacherSchema;
export type UpdateParentInput = z.infer<typeof updateParentSchema>;

export const updateStudentSchema = z.object({
  fullName: z.string().trim().min(1, "Нэр шаардлагатай").max(120).optional(),
  school: z.string().trim().max(120).nullable().optional(),
  grade: z.string().trim().max(40).nullable().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
