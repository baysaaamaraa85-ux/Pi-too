import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "./portal.service.js";

const studentIdParamSchema = z.object({ studentId: z.uuid() });
const contractIdParamSchema = z.object({ contractId: z.uuid() });

export async function getSummary(req: Request, res: Response) {
  res.status(200).json(await service.getSummary(req.user!));
}

export async function getStudentAttendance(req: Request, res: Response) {
  const { studentId } = studentIdParamSchema.parse(req.params);
  res.status(200).json(await service.getStudentAttendance(req.user!, studentId));
}

export async function getPaymentInstructions(req: Request, res: Response) {
  const { contractId } = contractIdParamSchema.parse(req.params);
  res.status(200).json(await service.getPaymentInstructions(req.user!, contractId));
}
