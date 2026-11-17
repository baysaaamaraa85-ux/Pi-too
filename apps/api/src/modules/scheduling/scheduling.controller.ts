import type { Request, Response } from "express";
import { z } from "zod";
import {
  availableClassesQuerySchema,
  createClassSchema,
  enrollInClassSchema,
  listLessonsQuerySchema,
  rescheduleLessonSchema,
} from "@pitoo/contracts";
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

export async function deleteClass(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deleteClass(req.user!, id);
  res.status(204).end();
}

export async function listClasses(req: Request, res: Response) {
  const branchId = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
  const teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : undefined;
  res.status(200).json(await service.listClasses({ branchId, teacherId }));
}

export async function listAvailableClasses(req: Request, res: Response) {
  const { branchId, weekday, teacherId } = availableClassesQuerySchema.parse(req.query);
  res.status(200).json(await service.listAvailableClasses({ branchId, weekday, teacherId }));
}

export async function enrollInClass(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { contractId, fromDate } = enrollInClassSchema.parse(req.body);
  res.status(201).json(await service.enrollContractInClass(contractId, id, new Date(fromDate)));
}

export async function listLessons(req: Request, res: Response) {
  const { from, to } = listLessonsQuerySchema.parse(req.query);
  res
    .status(200)
    .json(await service.listLessonsForUser(req.user!, new Date(from), new Date(to)));
}

export async function cancelLesson(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.cancelLesson(id, req.user!));
}

export async function rescheduleLesson(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { startsAt, endsAt } = rescheduleLessonSchema.parse(req.body);
  res
    .status(200)
    .json(await service.rescheduleLesson(id, req.user!, new Date(startsAt), new Date(endsAt)));
}

// D-69
export async function listWeekClasses(req: Request, res: Response) {
  const teacherId = typeof req.query.teacherId === "string" ? req.query.teacherId : undefined;
  res.status(200).json(await service.listWeekClasses(req.user!, teacherId));
}

export async function listClassRoster(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.listClassRoster(req.user!, id));
}
