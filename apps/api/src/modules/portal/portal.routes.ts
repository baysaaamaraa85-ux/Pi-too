import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./portal.controller.js";

export const portalRouter = Router();

portalRouter.use("/portal", authenticate);

portalRouter.get("/portal/summary", authorize("PARENT", "STUDENT"), controller.getSummary);
portalRouter.get(
  "/portal/students/:studentId/attendance",
  authorize("PARENT", "STUDENT"),
  controller.getStudentAttendance,
);
// ФШ-66: сурагч төлбөрийн мэдээлэл харахгүй (зөвхөн PARENT).
portalRouter.get(
  "/portal/contracts/:contractId/payment-instructions",
  authorize("PARENT"),
  controller.getPaymentInstructions,
);
