import type {
  BalanceDto,
  ClaimDto,
  CreatePaymentInput,
  DebtRowDto,
  DebtsQuery,
  PaymentDto,
  PaymentStatus,
  PaymentsQuery,
  UpdatePaymentInput,
} from "@pitoo/contracts";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { runIdempotent } from "../../shared/idempotency/run-idempotent.js";
import { enqueue } from "../../shared/outbox/enqueue.js";
import { balancesFor, computeBalance, paidByContract } from "../../shared/payments/payment-status.js";
import { getPaymentAccount } from "../catalog/catalog.service.js";
import { getContractForUserInTx, notifyParentsInTx, type PortalUser } from "../enrollment/enrollment.service.js";
import * as repo from "./payments.repository.js";

// М7 Төлбөр ба өр (ФШ-46...52, 76, 77). Төлөв хадгалагдахгүй, тооцоологдоно.

interface Actor {
  id: string;
  role: Role;
}

function rejected(status: number, code: string, title: string, detail: string): never {
  throw new DomainError({ code, status, title, detail });
}

function contractNotFound(): never {
  return rejected(404, "contract-not-found", "Гэрээ олдсонгүй", "Заасан гэрээ бүртгэлгүй байна.");
}

async function balanceDto(
  tx: Tx,
  contract: { id: string; price: Prisma.Decimal },
  pendingClaim: boolean,
): Promise<BalanceDto> {
  const paid = (await paidByContract(tx, [contract.id])).get(contract.id) ?? new Prisma.Decimal(0);
  const b = computeBalance(contract.price, paid);
  const status: PaymentStatus = pendingClaim && b.balance.gt(0) ? "PENDING" : b.status;
  return {
    contractId: contract.id,
    price: contract.price.toFixed(2),
    paid: b.paid.toFixed(2),
    balance: b.balance.toFixed(2),
    status,
  };
}

function mapPayment(p: NonNullable<Awaited<ReturnType<typeof repo.findPayment>>>): PaymentDto {
  return {
    id: p.id,
    contractId: p.contractId,
    studentName: p.contract.student.fullName,
    programName: p.contract.program.name,
    amount: p.amount.toFixed(2),
    paidAt: p.paidAt.toISOString().slice(0, 10),
    channel: p.channel,
    reference: p.reference,
    status: p.status,
    cancelReason: p.cancelReason,
    createdAt: p.createdAt.toISOString(),
  };
}

// ФШ-46: төлбөр бүртгэх (нэг транзакцад аудит, эцэг эхэд мэдэгдэл).
async function recordPaymentInTx(tx: Tx, actor: Actor, contractId: string, input: CreatePaymentInput) {
  const contract = await repo.findContract(tx, contractId);
  if (!contract) contractNotFound();
  const payment = await repo.createPayment(tx, {
    contractId,
    amount: input.amount,
    paidAt: new Date(input.paidAt),
    channel: input.channel,
    reference: input.reference,
    createdBy: actor.id,
  });
  await writeAudit(tx, {
    entity: "payment",
    entityId: payment.id,
    action: "CREATE",
    after: { contractId, amount: input.amount, paidAt: input.paidAt, channel: input.channel },
    actorId: actor.id,
  });
  const balance = await balanceDto(tx, contract, false);
  await notifyParentsInTx(tx, contract.studentId, "payment_recorded", {
    studentName: contract.student.fullName,
    amount: input.amount,
    balance: balance.balance,
  });
  return { payment: mapPayment(payment), balance };
}

export function recordPayment(actor: Actor, contractId: string, input: CreatePaymentInput, key: string) {
  return runIdempotent(key, actor.id, (tx) => recordPaymentInTx(tx, actor, contractId, input));
}

// ФШ-52: засахад шалтгаан заавал, анхны утга аудитад.
export function updatePayment(actor: Actor, id: string, input: UpdatePaymentInput) {
  return prisma.$transaction(async (tx) => {
    const found = await repo.findPayment(tx, id);
    if (!found) rejected(404, "payment-not-found", "Төлбөр олдсонгүй", "Заасан төлбөрийн бичлэг байхгүй.");
    if (found.status === "CANCELLED") {
      rejected(409, "payment-cancelled", "Төлбөр цуцлагдсан", "Цуцалсан төлбөрийг засах боломжгүй.");
    }
    const updated = await repo.updatePayment(tx, id, {
      ...(input.amount ? { amount: input.amount } : {}),
      ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
    });
    await writeAudit(tx, {
      entity: "payment",
      entityId: id,
      action: "UPDATE",
      before: { amount: found.amount.toFixed(2), paidAt: found.paidAt.toISOString().slice(0, 10), reference: found.reference },
      after: { amount: updated.amount.toFixed(2), paidAt: updated.paidAt.toISOString().slice(0, 10), reference: updated.reference },
      reason: input.reason,
      actorId: actor.id,
    });
    return mapPayment(updated);
  });
}

// ФШ-52, ФБШ-12: устгахгүй, цуцлах. Цуцалсан төлбөр үлдэгдлийн тооцоонд орохгүй.
export function cancelPayment(actor: Actor, id: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const found = await repo.findPayment(tx, id);
    if (!found) rejected(404, "payment-not-found", "Төлбөр олдсонгүй", "Заасан төлбөрийн бичлэг байхгүй.");
    if (found.status === "CANCELLED") {
      rejected(409, "payment-cancelled", "Төлбөр аль хэдийн цуцлагдсан", "Энэ төлбөр өмнө нь цуцлагдсан байна.");
    }
    const updated = await repo.updatePayment(tx, id, { status: "CANCELLED", cancelReason: reason });
    await writeAudit(tx, {
      entity: "payment",
      entityId: id,
      action: "CANCEL",
      before: { status: "ACTIVE", amount: found.amount.toFixed(2) },
      after: { status: "CANCELLED" },
      reason,
      actorId: actor.id,
    });
    return { payment: mapPayment(updated), balance: await balanceDto(tx, updated.contract, false) };
  });
}

export async function listPayments(q: PaymentsQuery) {
  const { items, total } = await repo.listPayments(prisma, q, q.page, q.limit);
  return { items: items.map(mapPayment), page: q.page, limit: q.limit, total };
}

// ФШ-48: өртэй гэрээний жагсаалт. Нийт өр нь шүүлтээс хамаарна; шүүлтгүйгээр ФШ-69-ийн нийт өртэй тэнцүү.
async function debtRows(f: {
  branchId?: string;
  teacherId?: string;
  sinceDays?: number;
  search?: string;
}): Promise<DebtRowDto[]> {
  const startedBefore =
    f.sinceDays !== undefined ? new Date(Date.now() - f.sinceDays * 86_400_000) : undefined;
  const contracts = await repo.listContractsForDebts(prisma, { ...f, startedBefore });
  const balances = await balancesFor(prisma, contracts);
  const rows: DebtRowDto[] = [];
  for (const c of contracts) {
    const b = balances.get(c.id)!;
    if (!b.balance.gt(0)) continue;
    rows.push({
      contractId: c.id,
      price: c.price.toFixed(2),
      paid: b.paid.toFixed(2),
      balance: b.balance.toFixed(2),
      status: b.status,
      studentName: c.student.fullName,
      programName: c.program.name,
      branches: [...new Set(c.enrollments.map((e) => e.class.branch.name))],
      teachers: [...new Set(c.enrollments.map((e) => e.class.teacher.fullName))],
      startedOn: c.createdAt.toISOString().slice(0, 10),
    });
  }
  return rows;
}

export async function listDebts(q: DebtsQuery) {
  const all = await debtRows(q);
  const total = all
    .reduce((acc, r) => acc.plus(r.balance), new Prisma.Decimal(0))
    .toFixed(2);
  const start = (q.page - 1) * q.limit;
  return { items: all.slice(start, start + q.limit), page: q.page, limit: q.limit, total: all.length, totalDebt: total };
}

// ФШ-69-д ашиглагдах нийт өр.
export async function totalDebt(): Promise<string> {
  const all = await debtRows({});
  return all.reduce((acc, r) => acc.plus(r.balance), new Prisma.Decimal(0)).toFixed(2);
}

export async function getBalanceForUser(user: PortalUser | Actor, contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract =
      user.role === Role.ADMIN
        ? await repo.findContract(tx, contractId)
        : await getContractForUserInTx(tx, user as PortalUser, contractId);
    if (!contract) contractNotFound();
    const pending = await repo.findPendingClaim(tx, contractId);
    return balanceDto(tx, contract, pending !== null);
  });
}

// ФШ-49, 66, 77: эцэг эхийн "Гэрээ, төлбөр" карт. Зөвхөн өөрийн хүүхдийн гэрээ.
export function getPaymentCard(user: PortalUser, contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await getContractForUserInTx(tx, user, contractId);
    const account = await getPaymentAccount(tx);
    const pending = await repo.findPendingClaim(tx, contractId);
    const teacherNames = [...new Set(contract.enrollments.map((e) => e.class.teacher.fullName))];
    const balance = await balanceDto(tx, contract, pending !== null);
    return {
      ...balance,
      studentName: contract.student.fullName,
      programName: contract.program.name,
      account,
      // ФШ-49: гүйлгээний утгад хүүхдийн нэр, багшийн нэр.
      transferNote: [contract.student.fullName, ...teacherNames].join(" - "),
      pendingClaimId: pending?.id ?? null,
    };
  });
}

// ФШ-76: эцэг эх "Шилжүүлсэн" гэж мэдэгдэнэ. Нэг гэрээнд нэг л хүлээгдэж буй бичлэг.
export function createClaim(user: PortalUser, contractId: string, key: string) {
  return runIdempotent(key, user.id, async (tx) => {
    const contract = await getContractForUserInTx(tx, user, contractId);
    const balance = await balanceDto(tx, contract, false);
    if (Number(balance.balance) <= 0) {
      rejected(409, "nothing-to-pay", "Төлөх үлдэгдэл байхгүй", "Энэ гэрээний төлбөр бүрэн төлөгдсөн байна.");
    }
    if (await repo.findPendingClaim(tx, contractId)) {
      rejected(409, "claim-pending", "Мэдэгдэл хүлээгдэж байна", "Энэ гэрээнд шилжүүлгийн мэдэгдэл аль хэдийн илгээгдсэн байна.");
    }
    const claim = await repo.createClaim(tx, { contractId, parentId: user.id });
    for (const admin of await repo.findActiveAdmins(tx)) {
      await enqueue(tx, {
        recipientId: admin.id,
        channel: "PUSH",
        template: "payment_claim_created",
        payload: { studentName: contract.student.fullName, balance: balance.balance, claimId: claim.id },
      });
    }
    return { id: claim.id, contractId, status: "PENDING" as const };
  });
}

function mapClaim(
  c: NonNullable<Awaited<ReturnType<typeof repo.findClaim>>>,
  balance: string,
): ClaimDto {
  return {
    id: c.id,
    contractId: c.contractId,
    studentName: c.contract.student.fullName,
    programName: c.contract.program.name,
    parentName: c.parent.fullName,
    parentPhone: c.parent.phone,
    balance,
    status: c.status,
    claimedAt: c.claimedAt.toISOString(),
    rejectReason: c.rejectReason,
  };
}

export async function listClaims(status?: "PENDING" | "CONFIRMED" | "REJECTED"): Promise<ClaimDto[]> {
  const claims = await repo.listClaims(prisma, status);
  const balances = await balancesFor(prisma, claims.map((c) => c.contract));
  return claims.map((c) => mapClaim(c, balances.get(c.contractId)!.balance.toFixed(2)));
}

// ФШ-76, 3.8.6 (3): админ банкны хуулгаас олж бүртгэхэд төлбөр, аудит, CONFIRMED нэг транзакцад.
export function confirmClaim(actor: Actor, claimId: string, input: CreatePaymentInput, key: string) {
  return runIdempotent(key, actor.id, async (tx) => {
    const claim = await repo.findClaim(tx, claimId);
    if (!claim) rejected(404, "claim-not-found", "Мэдэгдэл олдсонгүй", "Заасан шилжүүлгийн мэдэгдэл байхгүй.");
    if (claim.status !== "PENDING") {
      rejected(409, "claim-resolved", "Мэдэгдэл шийдвэрлэгдсэн", "Энэ мэдэгдэл аль хэдийн шийдвэрлэгдсэн байна.");
    }
    const { payment, balance } = await recordPaymentInTx(tx, actor, claim.contractId, input);
    await repo.resolveClaim(tx, claimId, {
      status: "CONFIRMED",
      resolver: { connect: { id: actor.id } },
      resolvedAt: new Date(),
      payment: { connect: { id: payment.id } },
    });
    await writeAudit(tx, {
      entity: "payment_claim",
      entityId: claimId,
      action: "CONFIRM",
      after: { paymentId: payment.id },
      actorId: actor.id,
    });
    return { claimId, payment, balance };
  });
}

// 3.8.6 (4): гүйлгээ олдоогүй бол шалтгаан бичиж татгалзана, эцэг эхэд шалтгаантай мэдэгдэл.
export function rejectClaim(actor: Actor, claimId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await repo.findClaim(tx, claimId);
    if (!claim) rejected(404, "claim-not-found", "Мэдэгдэл олдсонгүй", "Заасан шилжүүлгийн мэдэгдэл байхгүй.");
    if (claim.status !== "PENDING") {
      rejected(409, "claim-resolved", "Мэдэгдэл шийдвэрлэгдсэн", "Энэ мэдэгдэл аль хэдийн шийдвэрлэгдсэн байна.");
    }
    await repo.resolveClaim(tx, claimId, {
      status: "REJECTED",
      resolver: { connect: { id: actor.id } },
      resolvedAt: new Date(),
      rejectReason: reason,
    });
    await writeAudit(tx, {
      entity: "payment_claim",
      entityId: claimId,
      action: "REJECT",
      reason,
      actorId: actor.id,
    });
    await enqueue(tx, {
      recipientId: claim.parentId,
      channel: "PUSH",
      template: "payment_claim_rejected",
      payload: { studentName: claim.contract.student.fullName, reason },
    });
    return { claimId, status: "REJECTED" as const };
  });
}
