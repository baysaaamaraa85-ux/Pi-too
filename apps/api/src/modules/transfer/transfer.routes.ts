import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./transfer.controller.js";

export const transferRouter = Router();

transferRouter.use(authenticate);

// ФШ-71 (М12): админ. D-69: багш зөвхөн өөрийн ангиас (service эзэмшлийг шалгана), анги устгахаасаа өмнө сурагчаа зөөхөд.
transferRouter.post("/contracts/:id/transfer", authorize("ADMIN", "TEACHER"), controller.transferContract);
// D-73: сурагчийн бүх цагийг нэг дор шилжүүлэх (багшийн "Сурагч шилжүүлэх" цонх).
transferRouter.post("/contracts/:id/transfer-many", authorize("ADMIN", "TEACHER"), controller.transferContractMany);
