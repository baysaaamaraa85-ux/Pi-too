import type { Request, Response } from "express";
import {
  createPayoutSchema,
  exportQuerySchema,
  ledgerQuerySchema,
  payrollSummaryQuerySchema,
} from "@pitoo/contracts";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as ledger from "./payroll.ledger.js";

export async function listLedger(req: Request, res: Response) {
  const query = ledgerQuerySchema.parse(req.query);
  res.status(200).json(await ledger.listLedger(req.user!, query));
}

export async function payrollSummary(req: Request, res: Response) {
  const query = payrollSummaryQuerySchema.parse(req.query);
  res.status(200).json(await ledger.payrollSummary(query));
}

export async function createPayout(req: Request, res: Response) {
  const input = createPayoutSchema.parse(req.body);
  const key = req.header("Idempotency-Key");
  if (!key || key.length > 200) {
    throw new DomainError({
      code: "idempotency-key-required",
      status: 422,
      title: "Idempotency-Key дутуу байна",
      detail: "Давтан илгээлтээс хамгаалахын тулд Idempotency-Key толгой шаардлагатай.",
    });
  }
  res.status(201).json(await ledger.createPayout(req.user!, input, key));
}

export async function exportReport(req: Request, res: Response) {
  const query = exportQuerySchema.parse(req.query);
  const file = await ledger.exportReport(query);
  res
    .status(200)
    .set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "X-Report-Total": file.total,
    })
    .send(file.body);
}
