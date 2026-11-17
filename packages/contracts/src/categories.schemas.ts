import { z } from "zod";

// D-69: багш зөвхөн өөртөө зориулж сурагчдаа өөрийн нэрлэсэн категориор ангилна (самбарыг цэгцтэй харуулах).
export const teacherCategoryNameSchema = z.object({
  name: z.string().trim().min(1, "Категорийн нэр шаардлагатай").max(40, "Нэр 40 тэмдэгтээс богино байх ёстой"),
});
export type TeacherCategoryNameInput = z.infer<typeof teacherCategoryNameSchema>;

// categoryId = null бол сурагчийг категориос гаргана.
export const setStudentCategorySchema = z.object({
  categoryId: z.uuid().nullable(),
});
export type SetStudentCategoryInput = z.infer<typeof setStudentCategorySchema>;

export interface TeacherCategoryItemDto {
  id: string;
  name: string;
  students: number;
}

export interface TeacherCategoriesDto {
  categories: TeacherCategoryItemDto[];
  // Категорид орсон сурагчид (ангилаагүй сурагч энд байхгүй).
  assignments: { studentId: string; categoryId: string }[];
}
