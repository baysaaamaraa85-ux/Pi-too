import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./payroll.controller.js";

export const payrollRouter = Router();

payrollRouter.use(authenticate);

// ФШ-56, 58: админ бүгдийг, багш зөвхөн өөрийн мөрийг (service эзэмшлийг шалгана).
payrollRouter.get("/ledger", authorize("ADMIN", "TEACHER"), controller.listLedger);
payrollRouter.get("/payroll/summary", authorize("ADMIN"), controller.payrollSummary);
payrollRouter.post("/payouts", authorize("ADMIN"), controller.createPayout);
payrollRouter.get("/reports/payroll", authorize("ADMIN"), controller.exportReport);
