import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./categories.controller.js";

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

// D-69: зөвхөн багш, зөвхөн өөрийн категори (service эзэмшлийг шалгана).
categoriesRouter.get("/teacher/categories", authorize("TEACHER"), controller.listCategories);
categoriesRouter.post("/teacher/categories", authorize("TEACHER"), controller.createCategory);
categoriesRouter.patch("/teacher/categories/:id", authorize("TEACHER"), controller.renameCategory);
categoriesRouter.delete("/teacher/categories/:id", authorize("TEACHER"), controller.deleteCategory);
categoriesRouter.put("/teacher/students/:id/category", authorize("TEACHER"), controller.setStudentCategory);
