import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./directory.controller.js";

export const directoryRouter = Router();

directoryRouter.use(authenticate);

// Админы хэрэглэгчийн удирдлага (шинэ шаардлага 1.2). Жагсаалт, дэлгэрэнгүй, засвар
// зөвхөн админ. GET /parents нь ?phone= үед багшид ч нээлттэй (ФШ-13).
directoryRouter.get("/setup/status", authorize("ADMIN"), controller.getSetupStatus);
directoryRouter.get("/teachers", authorize("ADMIN"), controller.listTeachers);
directoryRouter.post("/teachers", authorize("ADMIN"), controller.createTeacher);
directoryRouter.get("/teachers/:id", authorize("ADMIN"), controller.getTeacher);
directoryRouter.patch("/teachers/:id", authorize("ADMIN"), controller.updateTeacher);

directoryRouter.get("/parents", authorize("ADMIN", "TEACHER"), controller.listParents);
directoryRouter.post("/parents", authorize("ADMIN"), controller.createParent);
directoryRouter.get("/parents/:id", authorize("ADMIN"), controller.getParent);
directoryRouter.patch("/parents/:id", authorize("ADMIN"), controller.updateParent);

directoryRouter.get("/students", authorize("ADMIN"), controller.listStudents);
directoryRouter.get("/students/:id", authorize("ADMIN"), controller.getStudent);
directoryRouter.patch("/students/:id", authorize("ADMIN"), controller.updateStudent);
