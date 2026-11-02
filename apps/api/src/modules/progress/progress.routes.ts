import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./progress.controller.js";

export const progressRouter = Router();

progressRouter.use(authenticate);

// ФШ-38: сорил бүртгэх (багш өөрийн сурагчид, админ бүгдэд; эзэмшлийг service шалгана).
progressRouter.post("/students/:id/assessments", authorize("ADMIN", "TEACHER"), controller.recordAssessment);
// ФШ-41, 42: дүнгийн түүх, сул сэдэв (Хүснэгт 2.2: бүгд өөрийн хэмжээнд).
progressRouter.get(
  "/students/:id/progress",
  authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"),
  controller.getProgress,
);
// ФШ-44
progressRouter.post("/lessons/:id/notes", authorize("TEACHER"), controller.addNote);
progressRouter.get("/contracts/:id/notes", authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"), controller.listNotes);
progressRouter.patch("/notes/:id", authorize("TEACHER"), controller.updateNote);
// ФШ-45
progressRouter.post("/contracts/:id/meetings", authorize("TEACHER"), controller.addMeeting);
progressRouter.get("/contracts/:id/meetings", authorize("ADMIN", "TEACHER"), controller.listMeetings);
