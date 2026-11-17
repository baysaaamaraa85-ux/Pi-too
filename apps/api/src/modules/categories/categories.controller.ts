import type { Request, Response } from "express";
import { z } from "zod";
import { setStudentCategorySchema, teacherCategoryNameSchema } from "@pitoo/contracts";
import * as service from "./categories.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function listCategories(req: Request, res: Response) {
  res.status(200).json(await service.listCategories(req.user!.id));
}

export async function createCategory(req: Request, res: Response) {
  const { name } = teacherCategoryNameSchema.parse(req.body);
  res.status(201).json(await service.createCategory(req.user!.id, name));
}

export async function renameCategory(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { name } = teacherCategoryNameSchema.parse(req.body);
  res.status(200).json(await service.renameCategory(req.user!.id, id, name));
}

export async function deleteCategory(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await service.deleteCategory(req.user!.id, id);
  res.status(204).end();
}

export async function setStudentCategory(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { categoryId } = setStudentCategorySchema.parse(req.body);
  res.status(200).json(await service.setStudentCategory(req.user!.id, id, categoryId));
}
