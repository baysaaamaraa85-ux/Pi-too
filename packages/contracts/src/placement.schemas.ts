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

// D-102: админ салбарын ахлагчийг томилно. teacherId = null бол ахлагчийг хасна.
export const setBranchLeadSchema = z.object({
  teacherId: z.uuid().nullable(),
});
export type SetBranchLeadInput = z.infer<typeof setBranchLeadSchema>;

// D-102: салбарын ахлагч хүсэлтийг салбарын өөр багшид шилжүүлнэ.
export const forwardPlacementRequestSchema = z.object({
  teacherId: z.uuid(),
});
export type ForwardPlacementRequestInput = z.infer<typeof forwardPlacementRequestSchema>;

// Хүсэлтийн хариу (админ, багш хоёуланд). assignedTeacher = null бол хуваарилагдаагүй (зөвхөн админ харна).
export interface PlacementRequestDto {
  id: string;
  studentName: string;
  school: string | null;
  grade: string | null;
  phone: string;
  programInterest: string | null;
  status: PlacementRequestStatus;
  note: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
  assignedTeacher: { id: string; fullName: string } | null;
}

// Багшийн "Түвшин тогтоох хүсэлт" хуудас: тухайн багш ахлагч мөн эсэх, ахалж буй салбарууд, харж болох хүсэлтүүд.
export interface TeacherPlacementRequestsDto {
  isLead: boolean;
  ledBranches: { id: string; name: string }[];
  requests: PlacementRequestDto[];
}

// Шилжүүлэх боломжтой багш нар.
export interface PlacementForwardCandidateDto {
  id: string;
  fullName: string;
}
