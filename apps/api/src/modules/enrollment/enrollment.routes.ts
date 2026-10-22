import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./enrollment.controller.js";

export const enrollmentRouter = Router();

enrollmentRouter.use(authenticate);
enrollmentRouter.use(authorize("ADMIN", "TEACHER"));

enrollmentRouter.get("/parents", controller.searchParents);
enrollmentRouter.post("/students", controller.createStudent);
enrollmentRouter.post("/students/:id/assessments", controller.createAssessment);
enrollmentRouter.post("/contracts", controller.createContract);
enrollmentRouter.put("/contracts/:id/plan", controller.updateContractPlan);
enrollmentRouter.post("/contracts/:id/pause", controller.pauseContract);
enrollmentRouter.post("/contracts/:id/resume", controller.resumeContract);

// Нийтийн сайтаас ирсэн түвшин тогтоох хүсэлтийг зөвхөн админ харж, төлөв шинэчилнэ.
enrollmentRouter.get("/placement-requests", authorize("ADMIN"), controller.listPlacementRequests);
enrollmentRouter.patch(
  "/placement-requests/:id",
  authorize("ADMIN"),
  controller.updatePlacementRequest,
);
