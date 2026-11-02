import type { Request, Response } from "express";
import { z } from "zod";
import {
  notificationsQuerySchema,
  subscribePushSchema,
  unsubscribePushSchema,
  updateNotificationSettingsSchema,
} from "@pitoo/contracts";
import * as service from "./notifications.service.js";

const idParamSchema = z.object({ id: z.uuid() });

export async function listNotifications(req: Request, res: Response) {
  res.status(200).json(await service.listNotifications(notificationsQuerySchema.parse(req.query)));
}

export async function retryNotification(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.retryNotification(req.user!, id));
}

export async function acknowledge(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  res.status(200).json(await service.acknowledge(req.user!, id));
}

export async function subscribePush(req: Request, res: Response) {
  const input = subscribePushSchema.parse(req.body);
  res.status(201).json(await service.subscribePush(req.user!, input));
}

export async function unsubscribePush(req: Request, res: Response) {
  const { endpoint } = unsubscribePushSchema.parse(req.body);
  await service.unsubscribePush(req.user!, endpoint);
  res.status(204).end();
}

export async function getSettings(req: Request, res: Response) {
  res.status(200).json(await service.getSettings(req.user!));
}

export async function updateSettings(req: Request, res: Response) {
  const input = updateNotificationSettingsSchema.parse(req.body);
  res.status(200).json(await service.updateSettings(req.user!, input));
}
