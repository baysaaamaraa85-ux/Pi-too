import type { Request, Response } from "express";
import { z } from "zod";
import { transferContractSchema, transferManySchema } from "@pitoo/contracts";
import * as service from "./transfer.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function transferContract(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = transferContractSchema.parse(req.body);
  res.status(200).json(await service.transferContract(req.user!, id, input));
}

export async function transferContractMany(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = transferManySchema.parse(req.body);
  res.status(200).json(await service.transferContractMany(req.user!, id, input));
}
