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

const updateContactBase = z.object({
  fullName: z.string().trim().min(1, "Нэр шаардлагатай").max(120).optional(),
  phone: phoneSchema.optional(),
  email: emailOnUpdate,
});

// Нийтийн сайтад харагдах зураг: өөрийн сайтын зам (/images/...) эсвэл https хаяг. Бусад (javascript: гэх мэт) татгалзана.
const photoUrlSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || v.startsWith("/images/") || v.startsWith("/uploads/") || /^https:\/\//.test(v), "Зураг /images/ эсвэл https:// хаягтай байх ёстой")
  .nullable();

export const updateTeacherSchema = updateContactBase.extend({
  specialties: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  photoUrl: photoUrlSchema.optional(),
});
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

// D-69: багш өөрийн нийтийн сайтад харагдах заах чиглэлээ (мэргэшил) өөрөө засна.
export const updateTeacherSpecialtiesSchema = z.object({
  specialties: z.array(z.string().trim().min(1).max(40)).max(8, "Хамгийн ихдээ 8 чиглэл"),
});
export type UpdateTeacherSpecialtiesInput = z.infer<typeof updateTeacherSpecialtiesSchema>;

export const updateParentSchema = updateContactBase;
export type UpdateParentInput = z.infer<typeof updateParentSchema>;

export const updateStudentSchema = z.object({
  fullName: z.string().trim().min(1, "Нэр шаардлагатай").max(120).optional(),
  school: z.string().trim().max(120).nullable().optional(),
  grade: z.string().trim().max(40).nullable().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
