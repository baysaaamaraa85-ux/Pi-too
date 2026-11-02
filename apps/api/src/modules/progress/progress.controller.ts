import type { Request, Response } from "express";
import { z } from "zod";
import {
  createMeetingSchema,
  createNoteSchema,
  recordAssessmentSchema,
  updateNoteSchema,
} from "@pitoo/contracts";
import * as service from "./progress.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function recordAssessment(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = recordAssessmentSchema.parse(req.body);
  res.status(201).json(await service.recordAssessment(req.user!, id, input));
}

export async function getProgress(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.getProgress(req.user!, id));
}

export async function addNote(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createNoteSchema.parse(req.body);
  res.status(201).json(await service.addNote(req.user!, id, input));
}

export async function listNotes(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.listNotes(req.user!, id));
}

export async function updateNote(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = updateNoteSchema.parse(req.body);
  res.status(200).json(await service.updateNote(req.user!, id, input));
}

export async function addMeeting(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = createMeetingSchema.parse(req.body);
  res.status(201).json(await service.addMeeting(req.user!, id, input));
}

export async function listMeetings(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.listMeetings(req.user!, id));
}
