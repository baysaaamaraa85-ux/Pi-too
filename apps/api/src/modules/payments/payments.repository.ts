import type { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../../shared/db/prisma.js";
import type { PaymentChannel } from "../../generated/prisma/client.js";

// Зөвхөн Prisma асуулга (CLAUDE.md 6.1).

export function findContract(tx: Tx, id: string) {
  return tx.contract.findUnique({
    where: { id },
    include: {
      student: true,
      program: true,
      enrollments: { where: { toDate: null }, include: { class: { include: { branch: true, teacher: true } } } },
    },
  });
}

export function createPayment(
  tx: Tx,
  data: {
    contractId: string;
    amount: string;
    paidAt: Date;
    channel: PaymentChannel;
    reference?: string;
    createdBy: string;
  },
) {
  return tx.payment.create({ data, include: { contract: { include: { student: true, program: true } } } });
}

export function findPayment(tx: Tx, id: string) {
  return tx.payment.findUnique({
    where: { id },
    include: { contract: { include: { student: true, program: true } } },
  });
}

export function updatePayment(tx: Tx, id: string, data: Prisma.PaymentUpdateInput) {
  return tx.payment.update({
    where: { id },
    data,
    include: { contract: { include: { student: true, program: true } } },
  });
}

export async function listPayments(
  tx: Tx,
  f: { contractId?: string; status?: "ACTIVE" | "CANCELLED"; search?: string },
  page: number,
  limit: number,
) {
  const where: Prisma.PaymentWhereInput = {
    ...(f.contractId ? { contractId: f.contractId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.search
      ? { contract: { student: { fullName: { contains: f.search, mode: "insensitive" } } } }
      : {}),
  };
  const [items, total] = await Promise.all([
    tx.payment.findMany({
      where,
      include: { contract: { include: { student: true, program: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    tx.payment.count({ where }),
  ]);
  return { items, total };
}

// ФШ-48: өртэй гэрээ (үнэ > төлсөн). Идэвхгүй ч (Дууссан) гэрээний өр хэвээр.
export function listContractsForDebts(
  tx: Tx,
  f: { branchId?: string; teacherId?: string; startedBefore?: Date; search?: string },
) {
  const classFilter: Prisma.ClassWhereInput = {
    ...(f.branchId ? { branchId: f.branchId } : {}),
    ...(f.teacherId ? { teacherId: f.teacherId } : {}),
  };
  return tx.contract.findMany({
    where: {
      ...(f.startedBefore ? { createdAt: { lte: f.startedBefore } } : {}),
      ...(f.branchId || f.teacherId ? { enrollments: { some: { class: classFilter } } } : {}),
      ...(f.search
        ? {
            OR: [
              { student: { fullName: { contains: f.search, mode: "insensitive" as const } } },
              {
                student: {
                  parentStudents: {
                    some: {
                      parent: {
                        OR: [
                          { fullName: { contains: f.search, mode: "insensitive" as const } },
                          { phone: { contains: f.search } },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      student: true,
      program: true,
      enrollments: { include: { class: { include: { branch: true, teacher: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function findPendingClaim(tx: Tx, contractId: string) {
  return tx.paymentClaim.findFirst({ where: { contractId, status: "PENDING" } });
}

export function createClaim(tx: Tx, data: { contractId: string; parentId: string }) {
  return tx.paymentClaim.create({ data });
}

export function findClaim(tx: Tx, id: string) {
  return tx.paymentClaim.findUnique({
    where: { id },
    include: {
      contract: { include: { student: true, program: true } },
      parent: true,
    },
  });
}

export function listClaims(tx: Tx, status?: "PENDING" | "CONFIRMED" | "REJECTED") {
  return tx.paymentClaim.findMany({
    where: status ? { status } : {},
    include: { contract: { include: { student: true, program: true } }, parent: true },
    orderBy: { claimedAt: "desc" },
  });
}

export function resolveClaim(
  tx: Tx,
  id: string,
  data: Prisma.PaymentClaimUpdateInput,
) {
  return tx.paymentClaim.update({ where: { id }, data });
}

export function findActiveAdmins(tx: Tx) {
  return tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
}
