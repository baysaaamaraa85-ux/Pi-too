import type { Request, Response } from "express";
import { z } from "zod";
import { createClassSchema, enrollInClassSchema } from "@pitoo/contracts";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as service from "./scheduling.service.js";

const idParamSchema = z.object({ id: z.uuid() });

function resolveTeacherId(req: Request, bodyTeacherId?: string): string {
  if (req.user!.role === "TEACHER") return req.user!.id;
  if (!bodyTeacherId) {
    throw new DomainError({
      code: "teacher-id-required",
      status: 422,
      title: "Багш заавал сонгоно",
      detail: "Админ анги үүсгэхдээ teacherId заавал дамжуулна.",
    });
  }
  return bodyTeacherId;
}

export async function createClass(req: Request, res: Response) {
  const { teacherId, branchId, weekday, startTime } = createClassSchema.parse(req.body);
  const resolvedTeacherId = resolveTeacherId(req, teacherId);
  res.status(201).json(await service.createClass(resolvedTeacherId, branchId, weekday, startTime));
}

export async function listClasses(req: Request, res: Response) {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : undefined;
  res.status(200).json(await service.listClasses({ branchId, teacherId }));
}

export async function listAvailableClasses(req: Request, res: Response) {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  res.status(200).json(await service.listAvailableClasses({ branchId }));
}

export async function enrollInClass(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { contractId, fromDate } = enrollInClassSchema.parse(req.body);
  res.status(201).json(await service.enrollContractInClass(contractId, id, new Date(fromDate)));
}
