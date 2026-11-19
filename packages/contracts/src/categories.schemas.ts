import { z } from "zod";

// D-69: багш зөвхөн өөртөө зориулж сурагчдаа өөрийн нэрлэсэн категориор ангилна (самбарыг цэгцтэй харуулах).
export const teacherCategoryNameSchema = z.object({
  name: z.string().trim().min(1, "Категорийн нэр шаардлагатай").max(40, "Нэр 40 тэмдэгтээс богино байх ёстой"),
});
export type TeacherCategoryNameInput = z.infer<typeof teacherCategoryNameSchema>;

// D-98: нэг сурагч нэг багшийн дээд тал нь 2 категорид байна.
export const MAX_STUDENT_CATEGORIES = 2;

// Сурагчийн категориудыг бүхлээр нь солино. Хоосон жагсаалт бол сурагчийг бүх категориос гаргана.
export const setStudentCategoriesSchema = z.object({
  categoryIds: z
    .array(z.uuid())
    .max(MAX_STUDENT_CATEGORIES, `Нэг сурагч дээд тал нь ${MAX_STUDENT_CATEGORIES} категорид байна`)
    .refine((ids) => new Set(ids).size === ids.length, "Ижил категорийг давтан сонгох боломжгүй"),
});
export type SetStudentCategoriesInput = z.infer<typeof setStudentCategoriesSchema>;

export interface TeacherCategoryItemDto {
  id: string;
  name: string;
  students: number;
}

export interface TeacherCategoriesDto {
  categories: TeacherCategoryItemDto[];
  // Категорид орсон сурагчид (ангилаагүй сурагч энд байхгүй). Нэг сурагч 2 мөртэй байж болно.
  assignments: { studentId: string; categoryId: string }[];
}
