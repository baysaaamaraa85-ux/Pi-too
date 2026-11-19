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

// D-67: багш хүүхэд тус бүр дээрээ цагийн үнэлгээгээ оруулна (өөрийн ангийн сурагч), захирал протоколоор тулгана.
payrollRouter.get("/payroll/my-rates", authorize("TEACHER"), controller.listMyRates);
payrollRouter.put("/contracts/:id/rate", authorize("TEACHER"), controller.setContractRate);
// D-99: бүх хүүхдийн цагийн цалинг нэг дор (нэг транзакц).
payrollRouter.put("/payroll/my-rates", authorize("TEACHER"), controller.setContractRates);
payrollRouter.get("/payroll/rate-protocol", authorize("ADMIN"), controller.getRateProtocol);

// D-68: багшийн цалин сурагч бүрээр ба "орсон цаг" дээр дарахад хичээл бүрийн дэлгэрэнгүй.
payrollRouter.get("/payroll/my-students", authorize("TEACHER"), controller.listMyStudents);
payrollRouter.get("/payroll/my-students/:id/entries", authorize("TEACHER"), controller.listStudentEntries);
