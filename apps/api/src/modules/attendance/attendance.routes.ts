import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./attendance.controller.js";

export const attendanceRouter = Router();

// ФШ-30: эцэг эх, сурагч чөлөө хүснэ (удирдлагын шийдвэр, 2026.10.27).
attendanceRouter.post(
  "/leave-requests",
  authenticate,
  authorize("PARENT", "STUDENT"),
  controller.createLeaveRequest,
);
