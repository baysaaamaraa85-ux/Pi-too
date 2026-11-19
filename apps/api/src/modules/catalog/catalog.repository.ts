import type { Tx } from "../../shared/db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

// Зөвхөн Prisma асуулга, шийдвэр гаргахгүй (CLAUDE.md 6.1).
export function findSetting(tx: Tx, key: string) {
  return tx.settings.findUnique({ where: { key } });
}

export function listSettings(tx: Tx) {
  return tx.settings.findMany({ orderBy: { key: "asc" } });
}

export function upsertSetting(
  tx: Tx,
  params: { key: string; value: Prisma.InputJsonValue; updatedBy: string },
) {
  return tx.settings.upsert({
    where: { key: params.key },
    update: { value: params.value, updatedBy: params.updatedBy },
    create: { key: params.key, value: params.value, updatedBy: params.updatedBy },
  });
}

// Идэвхгүй салбарыг зөвхөн админ (includeInactive) хардаг, бусад газар идэвхтэй нь л.
export function listBranches(tx: Tx, includeInactive = false) {
  return tx.branch.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: { leadTeacher: { select: { userId: true, fullName: true } } },
    orderBy: { name: "asc" },
  });
}

// D-102: салбарын ахлагчийг бичнэ (null = ахлагчгүй).
export function setBranchLead(tx: Tx, id: string, leadTeacherId: string | null) {
  return tx.branch.update({ where: { id }, data: { leadTeacherId } });
}

export function setBranchActive(tx: Tx, id: string, isActive: boolean) {
  return tx.branch.update({ where: { id }, data: { isActive } });
}

export function findBranchById(tx: Tx, id: string) {
  return tx.branch.findUnique({ where: { id } });
}

export interface BranchData {
  name?: string;
  address?: string;
  description?: string | null;
  phones?: string[];
  photoUrl?: string | null;
}

export function createBranch(tx: Tx, data: BranchData & { name: string; address: string }) {
  return tx.branch.create({ data });
}

export function updateBranch(tx: Tx, id: string, data: BranchData) {
  return tx.branch.update({ where: { id }, data });
}

export function countActiveClassesInBranch(tx: Tx, branchId: string) {
  return tx.class.count({ where: { branchId, isActive: true } });
}

// Салбарын ангиудын хичээлд ирц, цалингийн бичилт, тэмдэглэл байвал энэ нь түүх.
export async function countBranchClassHistory(tx: Tx, branchId: string) {
  const lesson = { lesson: { class: { branchId } } };
  const [attendance, ledger, notes] = await Promise.all([
    tx.attendance.count({ where: lesson }),
    tx.ledgerEntry.count({ where: lesson }),
    tx.lessonNote.count({ where: lesson }),
  ]);
  return { attendance, ledger, notes };
}

// Түүхгүй идэвхгүй ангиудыг хичээл, ангид бүртгэлтэй нь хамт устгана (салбар устгахын өмнө).
export async function deleteBranchClasses(tx: Tx, branchId: string) {
  await tx.leaveRequest.deleteMany({ where: { lesson: { class: { branchId } } } });
  await tx.lesson.deleteMany({ where: { class: { branchId } } });
  await tx.enrollment.deleteMany({ where: { class: { branchId } } });
  return tx.class.deleteMany({ where: { branchId } });
}

// Нийтийн сайтаас ирсэн хүсэлт хэвээр үлдэнэ, зөвхөн салбартай холбоо тасарна.
export function detachPlacementRequests(tx: Tx, branchId: string) {
  return tx.placementRequest.updateMany({ where: { branchId }, data: { branchId: null } });
}

export function deleteBranch(tx: Tx, id: string) {
  return tx.branch.delete({ where: { id } });
}

export function listPrograms(tx: Tx) {
  return tx.program.findMany({ orderBy: { name: "asc" } });
}

export function findProgramById(tx: Tx, id: string) {
  return tx.program.findUnique({ where: { id } });
}

export function createProgram(tx: Tx, data: { name: string; currentPrice: string }) {
  return tx.program.create({ data });
}

export function updateProgram(
  tx: Tx,
  id: string,
  data: { name?: string; currentPrice?: string; protocolHourlyRate?: string | null },
) {
  return tx.program.update({ where: { id }, data });
}


