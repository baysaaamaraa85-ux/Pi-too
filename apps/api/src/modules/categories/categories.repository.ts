import type { Tx } from "../../shared/db/prisma.js";

// Зөвхөн Prisma асуулга (CLAUDE.md 6.1).

export function listCategories(tx: Tx, teacherId: string) {
  return tx.teacherCategory.findMany({ where: { teacherId }, orderBy: { name: "asc" } });
}

export function findCategory(tx: Tx, id: string) {
  return tx.teacherCategory.findUnique({ where: { id } });
}

export function findCategoryByName(tx: Tx, teacherId: string, name: string) {
  return tx.teacherCategory.findUnique({ where: { teacherId_name: { teacherId, name } } });
}

export function createCategory(tx: Tx, teacherId: string, name: string) {
  return tx.teacherCategory.create({ data: { teacherId, name } });
}

export function renameCategory(tx: Tx, id: string, name: string) {
  return tx.teacherCategory.update({ where: { id }, data: { name } });
}

// Cascade устгалт хэрэглэхгүй (CLAUDE.md 7): эхлээд холбоосыг, дараа нь категорийг устгана.
export function deleteAssignments(tx: Tx, categoryId: string) {
  return tx.teacherCategoryStudent.deleteMany({ where: { categoryId } });
}

export function deleteCategory(tx: Tx, id: string) {
  return tx.teacherCategory.delete({ where: { id } });
}

export function listAssignments(tx: Tx, teacherId: string) {
  return tx.teacherCategoryStudent.findMany({
    where: { teacherId },
    select: { studentId: true, categoryId: true },
  });
}

export function upsertAssignment(tx: Tx, p: { teacherId: string; studentId: string; categoryId: string }) {
  return tx.teacherCategoryStudent.upsert({
    where: { teacherId_studentId: { teacherId: p.teacherId, studentId: p.studentId } },
    update: { categoryId: p.categoryId },
    create: p,
  });
}

export function deleteAssignment(tx: Tx, teacherId: string, studentId: string) {
  return tx.teacherCategoryStudent.deleteMany({ where: { teacherId, studentId } });
}

// Багшийн одоогийн идэвхтэй сурагчид (идэвхтэй гэрээ, идэвхтэй бүртгэл).
export async function listActiveStudentIds(tx: Tx, teacherId: string): Promise<string[]> {
  const rows = await tx.contract.findMany({
    where: { status: "ACTIVE", enrollments: { some: { toDate: null, class: { teacherId } } } },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  return rows.map((r) => r.studentId);
}

// Багш энэ сурагчийг заадаг (идэвхтэй бүртгэлтэй) эсвэл заасан (ирцтэй) эсэх.
export async function teacherHasStudent(tx: Tx, teacherId: string, studentId: string) {
  const [enrolled, taught] = await Promise.all([
    tx.enrollment.findFirst({ where: { contract: { studentId }, class: { teacherId } }, select: { id: true } }),
    tx.attendance.findFirst({ where: { contract: { studentId }, lesson: { teacherId } }, select: { id: true } }),
  ]);
  return enrolled !== null || taught !== null;
}
