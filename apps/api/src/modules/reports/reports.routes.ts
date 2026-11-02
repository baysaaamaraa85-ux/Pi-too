import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./reports.controller.js";

export const reportsRouter = Router();

reportsRouter.use(authenticate);

// ФШ-68, 70: админ ба багшид өөр өөр самбар.
reportsRouter.get("/dashboard", authorize("ADMIN", "TEACHER"), controller.getDashboard);
// ФШ-69
reportsRouter.get("/reports/monthly", authorize("ADMIN"), controller.getMonthlyReport);
// Аудитын бүртгэл (админ унших).
reportsRouter.get("/audit-log", authorize("ADMIN"), controller.listAudit);
