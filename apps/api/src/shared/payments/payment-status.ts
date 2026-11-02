import { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../db/prisma.js";

// ФШ-47, 51, 77: төлбөрийн төлөв хадгалагдахгүй, ХҮЧИНТЭЙ (цуцлаагүй) төлбөрийн SUM-аас
// тооцоологдоно. Энэ нь олон модуль (ирц, элсэлт, директори, төлбөр) уншдаг тул shared-д
// байна, зөвхөн унших (view-тэй адил), бичихгүй.

export type ComputedPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface ContractBalance {
  paid: Prisma.Decimal;
  balance: Prisma.Decimal;
  status: ComputedPaymentStatus;
}

export function computeBalance(price: string | number | Prisma.Decimal, paid: string | number | Prisma.Decimal): ContractBalance {
  const priceD = new Prisma.Decimal(price);
  const paidD = new Prisma.Decimal(paid);
  const remaining = priceD.minus(paidD);
  const status: ComputedPaymentStatus = paidD.lte(0) ? "UNPAID" : remaining.gt(0) ? "PARTIAL" : "PAID";
  return { paid: paidD, balance: remaining.gt(0) ? remaining : new Prisma.Decimal(0), status };
}

// Гэрээ бүрийн төлсөн дүн (нэг GROUP BY).
export async function paidByContract(tx: Tx, contractIds: string[]): Promise<Map<string, Prisma.Decimal>> {
  if (contractIds.length === 0) return new Map();
  const rows = await tx.payment.groupBy({
    by: ["contractId"],
    where: { contractId: { in: contractIds }, status: "ACTIVE" },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.contractId, new Prisma.Decimal(r._sum.amount ?? 0)]));
}

export async function balancesFor(
  tx: Tx,
  contracts: { id: string; price: Prisma.Decimal }[],
): Promise<Map<string, ContractBalance>> {
  const paid = await paidByContract(
    tx,
    contracts.map((c) => c.id),
  );
  return new Map(contracts.map((c) => [c.id, computeBalance(c.price, paid.get(c.id) ?? 0)]));
}

// ФШ-51: багшид зөвхөн "Бүрэн" эсвэл "Үлдэгдэлтэй", дүнгүй.
export function teacherFlag(balance: ContractBalance): "FULL" | "DEBT" {
  return balance.balance.gt(0) ? "DEBT" : "FULL";
}
