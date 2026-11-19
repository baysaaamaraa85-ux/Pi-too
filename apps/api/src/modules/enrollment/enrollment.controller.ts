import type { Request, Response } from "express";
import { z } from "zod";
import {
  createContractSchema,
  createStudentSchema,
  enrollStudentSchema,
  listContractsQuerySchema,
  pauseContractSchema,
  resumeContractSchema,
  setContractDiscountSchema,
  updateContractPlanSchema,
} from "@pitoo/contracts";
import * as service from "./enrollment.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function createStudent(req: Request, res: Response) {
  const input = createStudentSchema.parse(req.body);
  res.status(201).json(await service.registerStudent(input));
}

// Шинэ шаардлага 1.4: сурагч, эцэг эх, гэрээ, ангийн бүртгэл нэг транзакцаар.
export async function enrollStudent(req: Request, res: Response) {
  const input = enrollStudentSchema.parse(req.body);
  res.status(201).json(await service.enrollNewStudent(req.user!, input));
}

export async function listContracts(req: Request, res: Response) {
  const query = listContractsQuerySchema.parse(req.query);
  res.status(200).json(await service.listContracts(req.user!, query));
}

export async function createContract(req: Request, res: Response) {
  const { studentId, programId, packageHours } = createContractSchema.parse(req.body);
  res.status(201).json(await service.createContract(studentId, programId, packageHours));
}

// D-67: ах дүүгийн хөнгөлөлт (зөвхөн админ).
export async function setContractDiscount(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { percent } = setContractDiscountSchema.parse(req.body);
  res.status(200).json(await service.setContractDiscount(req.user!.id, id, percent));
}

export async function updateContractPlan(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { items } = updateContractPlanSchema.parse(req.body);
  res.status(200).json(await service.updateContractPlan(req.user!, id, items));
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
