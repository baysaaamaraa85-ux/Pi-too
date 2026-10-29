import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLeaveRequestSchema,
  createMakeupSchema,
  patchAttendanceSchema,
  putAttendanceSchema,
} from "@pitoo/contracts";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as service from "./attendance.service.js";
import * as record from "./attendance.record.js";

const idParamSchema = z.object({ id: z.uuid() });

// ФБШ-15: ирц ба төлбөрийн POST, PUT хүсэлтэд Idempotency-Key толгой заавал.
function idempotencyKeyOf(req: Request): string {
  const key = req.header("Idempotency-Key");
  if (!key || key.length > 200) {
    throw new DomainError({
      code: "idempotency-key-required",
      status: 422,
      title: "Idempotency-Key дутуу байна",
      detail: "Давтан илгээлтээс хамгаалахын тулд Idempotency-Key толгой шаардлагатай.",
    });
  }
  return key;
}

export async function createLeaveRequest(req: Request, res: Response) {
  const { contractId, lessonId } = createLeaveRequestSchema.parse(req.body);
  res.status(201).json(await service.createLeaveRequest(req.user!, contractId, lessonId));
}

const dayQuerySchema = z.object({
  date: z.iso.date(),
  branchId: z.uuid().optional(),
  teacherId: z.uuid().optional(),
});

export async function listLessonsForDay(req: Request, res: Response) {
  const query = dayQuerySchema.parse(req.query);
  res.status(200).json(await record.listLessonsForDay(req.user!, query));
}

export async function getSheet(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await record.getAttendanceSheet(req.user!, id));
}

export async function putAttendance(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = putAttendanceSchema.parse(req.body);
  res.status(200).json(await record.saveAttendance(req.user!, id, input, idempotencyKeyOf(req)));
}

export async function listMakeupCandidates(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await record.listMakeupCandidates(req.user!, id));
}

export async function addMakeup(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createMakeupSchema.parse(req.body);
  res.status(201).json(await record.addMakeup(req.user!, id, input, idempotencyKeyOf(req)));
}

export async function patchAttendance(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = patchAttendanceSchema.parse(req.body);
  res.status(200).json(await record.patchAttendance(req.user!, id, input));
}

export async function getHistory(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await record.getAttendanceHistory(id));
}
