import type { Request, Response } from "express";
import { z } from "zod";
import { transferContractSchema } from "@pitoo/contracts";
import * as service from "./transfer.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function transferContract(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = transferContractSchema.parse(req.body);
  res.status(200).json(await service.transferContract(req.user!.id, id, input));
}
