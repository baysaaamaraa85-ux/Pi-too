import type { Request, Response } from "express";
import { z } from "zod";
import {
  createPlacementRequestSchema,
  forwardPlacementRequestSchema,
  setBranchLeadSchema,
  updatePlacementRequestSchema,
} from "@pitoo/contracts";
import * as service from "./placement.service.js";

const idParamSchema = z.object({ id: z.uuid() });
const placementStatusQuerySchema = z
  .enum(["NEW", "CONTACTED", "SCHEDULED", "DONE", "CANCELLED"])
  .optional();

export async function createPlacementRequest(req: Request, res: Response) {
  const input = createPlacementRequestSchema.parse(req.body);
  res.status(201).json(await service.createPlacementRequest(input));
}

// Админ бүх хүсэлтийг харна.
export async function listPlacementRequests(req: Request, res: Response) {
  const status = placementStatusQuerySchema.parse(req.query.status);
  res.status(200).json(await service.listPlacementRequests(status));
}

// D-102: багш өөрийн ахалдаг салбарын, эсвэл өөрт нь шилжүүлсэн хүсэлтийг харна.
export async function listMyPlacementRequests(req: Request, res: Response) {
  res.status(200).json(await service.listMyPlacementRequests(req.user!));
}

export async function updatePlacementRequest(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { status, note } = updatePlacementRequestSchema.parse(req.body);
  res.status(200).json(await service.updatePlacementRequest(req.user!, id, status, note));
}

export async function listForwardCandidates(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.listForwardCandidates(req.user!, id));
}

export async function forwardPlacementRequest(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { teacherId } = forwardPlacementRequestSchema.parse(req.body);
  res.status(200).json(await service.forwardPlacementRequest(req.user!, id, teacherId));
}

export async function setBranchLead(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { teacherId } = setBranchLeadSchema.parse(req.body);
  res.status(200).json(await service.setBranchLead(req.user!, id, teacherId));
}
