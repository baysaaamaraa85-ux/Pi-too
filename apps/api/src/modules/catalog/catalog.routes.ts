import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import { imageBody } from "../../shared/uploads/image-upload.js";
import * as controller from "./catalog.controller.js";

export const catalogRouter = Router();

catalogRouter.use(authenticate);

// Эрхийн матриц (requirements 2.3): салбар, хөтөлбөр, үнэ зөвхөн админ, багшид
// харагдана; эцэг эх, сурагч үгүй.
// ФШ-07: админ CRUD, багш зөвхөн GET.
catalogRouter.get("/branches", authorize("ADMIN", "TEACHER"), controller.listBranches);
catalogRouter.post("/branches", authorize("ADMIN"), controller.createBranch);
catalogRouter.patch("/branches/:id", authorize("ADMIN"), controller.updateBranch);
catalogRouter.put("/branches/:id/photo", authorize("ADMIN"), imageBody, controller.uploadBranchPhoto);

// ФШ-08
catalogRouter.get("/programs", authorize("ADMIN", "TEACHER"), controller.listPrograms);
catalogRouter.post("/programs", authorize("ADMIN"), controller.createProgram);
catalogRouter.patch("/programs/:id", authorize("ADMIN"), controller.updateProgram);

// ФШ-09, ФБШ-29
catalogRouter.get("/settings", authorize("ADMIN"), controller.listSettings);
catalogRouter.put("/settings", authorize("ADMIN"), controller.updateSetting);

