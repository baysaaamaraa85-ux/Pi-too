import type { Request, Response } from "express";
import { z } from "zod";
import {
  createAssessmentSchema,
  createPlacementRequestSchema,
  updatePlacementRequestSchema,
  createContractSchema,
  createStudentSchema,
  pauseContractSchema,
  resumeContractSchema,
  updateContractPlanSchema,
} from "@pitoo/contracts";
import * as service from "./enrollment.service.js";

const idParamSchema = z.object({ id: z.uuid() });
const placementStatusQuerySchema = z
  .enum(["NEW", "CONTACTED", "SCHEDULED", "DONE", "CANCELLED"])
  .optional();

export async function createStudent(req: Request, res: Response) {
  const input = createStudentSchema.parse(req.body);
  res.status(201).json(await service.registerStudent(input));
}

export async function createAssessment(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { takenOn, totalPercent } = createAssessmentSchema.parse(req.body);
  res.status(201).json(await service.recordPlacementAssessment(id, takenOn, totalPercent));
}

export async function createContract(req: Request, res: Response) {
  const { studentId, programId, rulesAckAt } = createContractSchema.parse(req.body);
  res.status(201).json(await service.createContract(studentId, programId, rulesAckAt));
}

export async function updateContractPlan(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { items } = updateContractPlanSchema.parse(req.body);
  res.status(200).json(await service.updateContractPlan(id, items));
}

export async function pauseContract(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { startedOn, reason, holdSeat } = pauseContractSchema.parse(req.body);
  res.status(201).json(await service.pauseContract(id, req.user!.id, startedOn, reason, holdSeat));
}

export async function resumeContract(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { resumedOn, classIds } = resumeContractSchema.parse(req.body);
  res.status(200).json(await service.resumeContract(id, req.user!.id, resumedOn, classIds));
}

export async function createPlacementRequest(req: Request, res: Response) {
  const input = createPlacementRequestSchema.parse(req.body);
  res.status(201).json(await service.createPlacementRequest(input));
}

export async function listPlacementRequests(req: Request, res: Response) {
  const status = placementStatusQuerySchema.parse(req.query.status);
  res.status(200).json(await service.listPlacementRequests(status));
}

export async function updatePlacementRequest(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { status, note } = updatePlacementRequestSchema.parse(req.body);
  res.status(200).json(await service.updatePlacementRequest(id, status, note));
}
