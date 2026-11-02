import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./transfer.controller.js";

export const transferRouter = Router();

transferRouter.use(authenticate);

// ФШ-71 (М12): зөвхөн админ.
transferRouter.post("/contracts/:id/transfer", authorize("ADMIN"), controller.transferContract);
