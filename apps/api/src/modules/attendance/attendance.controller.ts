import type { Request, Response } from "express";
import { createLeaveRequestSchema } from "@pitoo/contracts";
import * as service from "./attendance.service.js";

export async function createLeaveRequest(req: Request, res: Response) {
  const { contractId, lessonId } = createLeaveRequestSchema.parse(req.body);
  res.status(201).json(await service.createLeaveRequest(req.user!, contractId, lessonId));
}
