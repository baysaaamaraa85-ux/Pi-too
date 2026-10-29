import type { Request, Response } from "express";
import { z } from "zod";
import {
  createParentSchema,
  createTeacherSchema,
  listParentsQuerySchema,
  listStudentsQuerySchema,
  listTeachersQuerySchema,
  updateParentSchema,
  updateStudentSchema,
  updateTeacherSchema,
} from "@pitoo/contracts";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as service from "./directory.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function getSetupStatus(_req: Request, res: Response) {
  res.status(200).json(await service.getSetupStatus());
}

export async function listTeachers(req: Request, res: Response) {
  res.status(200).json(await service.listTeachers(listTeachersQuerySchema.parse(req.query)));
}
export async function getTeacher(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.getTeacher(id));
}
export async function createTeacher(req: Request, res: Response) {
  const input = createTeacherSchema.parse(req.body);
  res.status(201).json(await service.createTeacher(input, req.user!.id));
}
export async function updateTeacher(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateTeacherSchema.parse(req.body);
  res.status(200).json(await service.updateTeacher(id, input, req.user!.id));
}

// GET /parents: ?phone= бол утсаар хайх (админ, багш: ФШ-13), үгүй бол админы жагсаалт.
export async function listParents(req: Request, res: Response) {
  if (typeof req.query.phone === "string") {
    res.status(200).json(await service.searchParents(req.query.phone));
    return;
  }
  if (req.user?.role !== "ADMIN") {
    throw new DomainError({
      code: "forbidden",
      status: 403,
      title: "Эрх хүрэхгүй байна",
      detail: "Энэ үйлдлийг хийх эрхгүй байна.",
    });
  }
  res.status(200).json(await service.listParents(listParentsQuerySchema.parse(req.query)));
}
export async function getParent(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.getParent(id));
}
export async function createParent(req: Request, res: Response) {
  const input = createParentSchema.parse(req.body);
  res.status(201).json(await service.createParent(input, req.user!.id));
}
export async function updateParent(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateParentSchema.parse(req.body);
  res.status(200).json(await service.updateParent(id, input, req.user!.id));
}

export async function listStudents(req: Request, res: Response) {
  res.status(200).json(await service.listStudents(listStudentsQuerySchema.parse(req.query)));
}
export async function getStudent(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.getStudent(id));
}
export async function updateStudent(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateStudentSchema.parse(req.body);
  res.status(200).json(await service.updateStudent(id, input, req.user!.id));
}
