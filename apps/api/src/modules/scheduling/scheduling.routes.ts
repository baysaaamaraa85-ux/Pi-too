import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./scheduling.controller.js";

export const schedulingRouter = Router();

schedulingRouter.use(authenticate);

// ФШ-15: сул суудалтай анги хайх (/classes-ийн өмнө байрлах ёстой, эс бөгөөс
// "available" :id мэт тооцогддог).
schedulingRouter.get(
  "/classes/available",
  authorize("ADMIN", "TEACHER"),
  controller.listAvailableClasses,
);
schedulingRouter.get("/classes", authorize("ADMIN", "TEACHER"), controller.listClasses);
schedulingRouter.post("/classes", authorize("ADMIN", "TEACHER"), controller.createClass);
schedulingRouter.post(
  "/classes/:id/enrollments",
  authorize("ADMIN", "TEACHER"),
  controller.enrollInClass,
);
