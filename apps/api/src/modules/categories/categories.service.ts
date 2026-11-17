import type { TeacherCategoriesDto, TeacherCategoryDto } from "@pitoo/contracts";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as repo from "./categories.repository.js";

// D-69: багшийн өөрийн категори. Багш зөвхөн өөрийнхийг харж, засна (BOLA, ADR-008).

function reject(status: number, code: string, title: string, detail: string): never {
  throw new DomainError({ code, status, title, detail });
}

async function ownCategory(teacherId: string, categoryId: string) {
  const category = await repo.findCategory(prisma, categoryId);
  if (!category) reject(404, "category-not-found", "Категори олдсонгүй", "Заасан категори бүртгэлгүй байна.");
  if (category.teacherId !== teacherId) {
    reject(403, "forbidden-category", "Эрх хүрэхгүй байна", "Энэ категори танных биш байна.");
  }
  return category;
}

function duplicate(name: string): never {
  return reject(409, "category-exists", "Категори байна", `"${name}" нэртэй категори аль хэдийн үүссэн байна.`);
}

export async function listCategories(teacherId: string): Promise<TeacherCategoriesDto> {
  const [categories, assignments, active] = await Promise.all([
    repo.listCategories(prisma, teacherId),
    repo.listAssignments(prisma, teacherId),
    repo.listActiveStudentIds(prisma, teacherId),
  ]);
  const activeSet = new Set(active);
  const counts = new Map<string, number>();
  for (const a of assignments) {
    if (activeSet.has(a.studentId)) counts.set(a.categoryId, (counts.get(a.categoryId) ?? 0) + 1);
  }
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, students: counts.get(c.id) ?? 0 })),
    assignments,
  };
}

export async function createCategory(teacherId: string, name: string) {
  if (await repo.findCategoryByName(prisma, teacherId, name)) duplicate(name);
  try {
    const c = await repo.createCategory(prisma, teacherId, name);
    return { id: c.id, name: c.name, students: 0 };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") duplicate(name);
    throw err;
  }
}

export async function renameCategory(teacherId: string, categoryId: string, name: string) {
  const category = await ownCategory(teacherId, categoryId);
  const same = await repo.findCategoryByName(prisma, teacherId, name);
  if (same && same.id !== category.id) duplicate(name);
  const c = await repo.renameCategory(prisma, categoryId, name);
  return { id: c.id, name: c.name };
}

// Категори устгахад сурагчид "Ангилаагүй" болно, сурагчид өөрөө хөндөгдөхгүй.
export async function deleteCategory(teacherId: string, categoryId: string) {
  await ownCategory(teacherId, categoryId);
  await prisma.$transaction(async (tx) => {
    await repo.deleteAssignments(tx, categoryId);
    await repo.deleteCategory(tx, categoryId);
  });
}

export async function setStudentCategory(teacherId: string, studentId: string, categoryId: string | null) {
  if (!(await repo.teacherHasStudent(prisma, teacherId, studentId))) {
    reject(403, "forbidden-student-category", "Эрх хүрэхгүй байна", "Та зөвхөн өөрийн сурагчийг ангилна.");
  }
  if (categoryId === null) {
    await repo.deleteAssignment(prisma, teacherId, studentId);
    return { studentId, categoryId: null };
  }
  await ownCategory(teacherId, categoryId);
  await repo.upsertAssignment(prisma, { teacherId, studentId, categoryId });
  return { studentId, categoryId };
}

// Багшийн самбар: категори бүрийн идэвхтэй сурагчийн тоо, ангилаагүй сурагчид "Ангилаагүй" гэж.
export async function dashboardCategories(teacherId: string): Promise<TeacherCategoryDto[]> {
  const [{ categories, assignments }, active] = await Promise.all([
    listCategories(teacherId),
    repo.listActiveStudentIds(prisma, teacherId),
  ]);
  const categorized = new Set(assignments.map((a) => a.studentId));
  const uncategorized = active.filter((id) => !categorized.has(id)).length;
  const rows: TeacherCategoryDto[] = categories
    .filter((c) => c.students > 0)
    .map((c) => ({ categoryId: c.id, name: c.name, students: c.students }))
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  if (uncategorized > 0) rows.push({ categoryId: null, name: "Ангилаагүй", students: uncategorized });
  return rows;
}
