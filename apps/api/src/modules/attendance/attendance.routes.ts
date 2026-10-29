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

// Ирц (М5, Хүснэгт 3.12): багш өөрийн хичээлд, админ бүгдэд. Эзэмшлийг service шалгана.
attendanceRouter.get(
  "/attendance/lessons",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.listLessonsForDay,
);
attendanceRouter.get(
  "/lessons/:id/attendance",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.getSheet,
);
attendanceRouter.put(
  "/lessons/:id/attendance",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.putAttendance,
);
attendanceRouter.get(
  "/lessons/:id/makeup-candidates",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.listMakeupCandidates,
);
attendanceRouter.post(
  "/lessons/:id/makeups",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.addMakeup,
);
attendanceRouter.patch(
  "/attendance/:id",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.patchAttendance,
);
attendanceRouter.get(
  "/attendance/:id/history",
  authenticate,
  authorize("ADMIN"),
  controller.getHistory,
);
