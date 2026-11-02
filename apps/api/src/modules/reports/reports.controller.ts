import type { Request, Response } from "express";
import { auditQuerySchema, monthlyReportQuerySchema } from "@pitoo/contracts";
import * as service from "./reports.service.js";

export async function getDashboard(req: Request, res: Response) {
  res.status(200).json(await service.getDashboard(req.user!));
}

export async function getMonthlyReport(req: Request, res: Response) {
  const { month } = monthlyReportQuerySchema.parse(req.query);
  res.status(200).json(await service.getMonthlyReport(month));
}

export async function listAudit(req: Request, res: Response) {
  res.status(200).json(await service.listAudit(auditQuerySchema.parse(req.query)));
}
