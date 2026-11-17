import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./payments.controller.js";

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

// Эрхийн матриц (Хүснэгт 2.2): төлбөр, өр админд бүрэн; эцэг эх өөрийн хүүхдийн үлдэгдэл,
// төлөв; багш зөвхөн төлөв (ирц, гэрээний жагсаалтаар); сурагчид үгүй (ФШ-66).
paymentsRouter.post("/contracts/:id/payments", authorize("ADMIN"), controller.recordPayment);
paymentsRouter.get("/contracts/:id/balance", authorize("ADMIN", "PARENT"), controller.getBalance);
paymentsRouter.get("/payments", authorize("ADMIN"), controller.listPayments);
paymentsRouter.patch("/payments/:id", authorize("ADMIN"), controller.updatePayment);
paymentsRouter.post("/payments/:id/cancel", authorize("ADMIN"), controller.cancelPayment);
paymentsRouter.get("/debts", authorize("ADMIN"), controller.listDebts);

// D-68: төлөгдөөгүй хүүхдийн эцэг эхэд мэдэгдэл, нэхэмжлэл (багш өөрийн хүүхдэд, админ).
paymentsRouter.post("/contracts/:id/payment-reminder", authorize("ADMIN", "TEACHER"), controller.sendPaymentReminder);

// ФШ-76: шилжүүлгийн мэдэгдэл.
paymentsRouter.post("/payment-claims", authorize("PARENT"), controller.createClaim);
paymentsRouter.get("/payment-claims", authorize("ADMIN"), controller.listClaims);
paymentsRouter.post("/payment-claims/:id/confirm", authorize("ADMIN"), controller.confirmClaim);
paymentsRouter.post("/payment-claims/:id/reject", authorize("ADMIN"), controller.rejectClaim);
