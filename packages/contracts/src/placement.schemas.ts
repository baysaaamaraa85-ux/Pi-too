import { z } from "zod";

import { phoneSchema } from "./common.schemas.js";

// Нийтийн сайтаас ирэх түвшин тогтоох цагийн хүсэлт (нэвтрэлтгүй).
export const createPlacementRequestSchema = z.object({
  studentName: z.string().trim().min(1, "Сурагчийн нэр шаардлагатай").max(120),
  school: z.string().trim().max(120).optional(),
  grade: z.string().trim().max(40).optional(),
  phone: phoneSchema,
  programInterest: z.string().trim().max(200).optional(),
  branchId: z.uuid().optional(),
});
export type CreatePlacementRequestInput = z.infer<typeof createPlacementRequestSchema>;

export const PlacementRequestStatus = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  SCHEDULED: "SCHEDULED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type PlacementRequestStatus =
  (typeof PlacementRequestStatus)[keyof typeof PlacementRequestStatus];

export const PLACEMENT_REQUEST_STATUS_LABELS: Record<PlacementRequestStatus, string> = {
  NEW: "Шинэ",
  CONTACTED: "Холбогдсон",
  SCHEDULED: "Цаг товлосон",
  DONE: "Түвшин тогтоосон",
  CANCELLED: "Цуцалсан",
};

export const updatePlacementRequestSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "SCHEDULED", "DONE", "CANCELLED"]),
  note: z.string().trim().max(500).optional(),
});
export type UpdatePlacementRequestInput = z.infer<typeof updatePlacementRequestSchema>;
