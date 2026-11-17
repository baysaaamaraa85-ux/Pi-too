import type { Request, Response } from "express";
import { z } from "zod";
import {
  cancelPaymentSchema,
  createClaimSchema,
  createPaymentSchema,
  debtsQuerySchema,
  paymentsQuerySchema,
  rejectClaimSchema,
  updatePaymentSchema,
} from "@pitoo/contracts";
import type { PortalUser } from "../enrollment/enrollment.service.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as service from "./payments.service.js";

const idParamSchema = z.object({ id: z.uuid() });

// ФБШ-15: төлбөрийн POST хүсэлтэд Idempotency-Key заавал.
function keyOf(req: Request): string {
  const key = req.header("Idempotency-Key");
  if (!key || key.length > 200) {
    throw new DomainError({
      code: "idempotency-key-required",
      status: 422,
      title: "Idempotency-Key дутуу байна",
      detail: "Давтан илгээлтээс хамгаалахын тулд Idempotency-Key толгой шаардлагатай.",
    });
  }
  return key;
}

export async function recordPayment(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createPaymentSchema.parse(req.body);
  res.status(201).json(await service.recordPayment(req.user!, id, input, keyOf(req)));
}

export async function getBalance(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.getBalanceForUser(req.user!, id));
}

export async function listPayments(req: Request, res: Response) {
  res.status(200).json(await service.listPayments(paymentsQuerySchema.parse(req.query)));
}

export async function updatePayment(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updatePaymentSchema.parse(req.body);
  res.status(200).json(await service.updatePayment(req.user!, id, input));
}

export async function cancelPayment(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { reason } = cancelPaymentSchema.parse(req.body);
  res.status(200).json(await service.cancelPayment(req.user!, id, reason));
}

export async function listDebts(req: Request, res: Response) {
  res.status(200).json(await service.listDebts(debtsQuerySchema.parse(req.query)));
}

export async function createClaim(req: Request, res: Response) {
  const { contractId } = createClaimSchema.parse(req.body);
  res.status(201).json(await service.createClaim(req.user as PortalUser, contractId, keyOf(req)));
}

const claimStatusSchema = z.enum(["PENDING", "CONFIRMED", "REJECTED"]).optional();

export async function listClaims(req: Request, res: Response) {
  res.status(200).json(await service.listClaims(claimStatusSchema.parse(req.query.status)));
}

export async function confirmClaim(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createPaymentSchema.parse(req.body);
  res.status(200).json(await service.confirmClaim(req.user!, id, input, keyOf(req)));
}

export async function rejectClaim(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { reason } = rejectClaimSchema.parse(req.body);
  res.status(200).json(await service.rejectClaim(req.user!, id, reason));
}

// D-68: төлөгдөөгүй хүүхдийн эцэг эхэд мэдэгдэл, нэхэмжлэл.
export async function sendPaymentReminder(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.sendPaymentReminder(req.user!, id));
}
