import type { Tx } from "../../shared/db/prisma.js";
import type { Prisma, PlacementRequestStatus } from "../../generated/prisma/client.js";

// Зөвхөн Prisma асуулга, шийдвэр гаргахгүй (CLAUDE.md 6.1). D-102: түвшин тогтоох хүсэлт, салбарын ахлагч.

const include = {
  branch: { select: { id: true, name: true, leadTeacherId: true, leadTeacher: { select: { fullName: true } } } },
  assignedTeacher: { select: { userId: true, fullName: true } },
} satisfies Prisma.PlacementRequestInclude;

export type PlacementRequestRow = Prisma.PlacementRequestGetPayload<{ include: typeof include }>;

export function createPlacementRequest(
  tx: Tx,
  data: {
    studentName: string;
    school?: string;
    grade?: string;
    phone: string;
    programInterest?: string;
    branchId?: string;
    assignedTeacherId?: string;
  },
) {
  return tx.placementRequest.create({ data });
}

export function findPlacementRequest(tx: Tx, id: string) {
  return tx.placementRequest.findUnique({ where: { id }, include });
}

// Админ бүгдийг харна.
export function listAllPlacementRequests(tx: Tx, status?: PlacementRequestStatus) {
  return tx.placementRequest.findMany({
    where: status ? { status } : undefined,
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

// Багш зөвхөн өөрийн ахалдаг салбарын, эсвэл өөрт нь шилжүүлсэн хүсэлтийг харна.
export function listPlacementRequestsForTeacher(tx: Tx, teacherId: string) {
  return tx.placementRequest.findMany({
    where: { OR: [{ assignedTeacherId: teacherId }, { branch: { leadTeacherId: teacherId } }] },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function updatePlacementRequest(
  tx: Tx,
  id: string,
  data: { status: PlacementRequestStatus; note?: string },
) {
  return tx.placementRequest.update({ where: { id }, data, include });
}

export function setPlacementAssignee(tx: Tx, id: string, assignedTeacherId: string | null) {
  return tx.placementRequest.update({ where: { id }, data: { assignedTeacherId }, include });
}

// Ахлагч солигдоход салбарын нээлттэй хүсэлтүүдийг шинэ хариуцагчид шилжүүлнэ.
// from: хуучин хариуцагч(ууд), null нь хуваарилагдаагүй хүсэлт.
export function reassignOpenPlacementRequests(
  tx: Tx,
  p: { branchId: string; from: (string | null)[]; to: string | null; openStatuses: PlacementRequestStatus[] },
) {
  return tx.placementRequest.updateMany({
    where: {
      branchId: p.branchId,
      status: { in: p.openStatuses },
      OR: p.from.map((assignedTeacherId) => ({ assignedTeacherId })),
    },
    data: { assignedTeacherId: p.to },
  });
}

export function findTeacherWithAccount(tx: Tx, teacherId: string) {
  return tx.teacher.findUnique({
    where: { userId: teacherId },
    select: { userId: true, fullName: true, user: { select: { isActive: true } } },
  });
}

export async function countActiveClassesOfTeacherInBranch(tx: Tx, teacherId: string, branchId: string) {
  return tx.class.count({ where: { teacherId, branchId, isActive: true } });
}

// Салбарт идэвхтэй анги заадаг, идэвхтэй данстай багш нар.
export function listBranchTeachers(tx: Tx, branchId: string) {
  return tx.teacher.findMany({
    where: { user: { isActive: true }, classes: { some: { branchId, isActive: true } } },
    select: { userId: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export function listBranchesLedBy(tx: Tx, teacherId: string) {
  return tx.branch.findMany({
    where: { leadTeacherId: teacherId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function findBranchLead(tx: Tx, branchId: string) {
  return tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, leadTeacherId: true, leadTeacher: { select: { user: { select: { isActive: true } } } } },
  });
}
