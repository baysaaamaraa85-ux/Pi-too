import type { Request, Response } from "express";
import { z } from "zod";
import {
  createBranchSchema,
  createProgramSchema,
  updateBranchSchema,
  updateProgramSchema,
  updateSettingSchema,
} from "@pitoo/contracts";
import * as service from "./catalog.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function listBranches(_req: Request, res: Response) {
  res.status(200).json(await service.listBranches());
}

export async function createBranch(req: Request, res: Response) {
  const data = createBranchSchema.parse(req.body);
  res.status(201).json(await service.createBranch(data));
}

export async function updateBranch(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateBranchSchema.parse(req.body);
  res.status(200).json(await service.updateBranch(id, data));
}

// ФШ-78: салбарын зураг (raw image/jpeg, png, webp).
export async function uploadBranchPhoto(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const image = Buffer.isBuffer(req.body) ? req.body : null;
  res.status(200).json(await service.setBranchPhoto(id, image, req.user!.id));
}

export async function listPrograms(_req: Request, res: Response) {
  res.status(200).json(await service.listPrograms());
}

export async function createProgram(req: Request, res: Response) {
  const { name, currentPrice } = createProgramSchema.parse(req.body);
  res.status(201).json(await service.createProgram(name, currentPrice));
}

export async function updateProgram(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateProgramSchema.parse(req.body);
  res.status(200).json(await service.updateProgram(id, data, req.user!.id));
}

export async function listSettings(_req: Request, res: Response) {
  res.status(200).json(await service.listSettings());
}

export async function updateSetting(req: Request, res: Response) {
  const { key, value } = updateSettingSchema.parse(req.body);
  res.status(200).json(await service.updateSetting(key, value, req.user!.id));
}
