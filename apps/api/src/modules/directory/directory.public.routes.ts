import { Router } from "express";
import { listPublicTeachers } from "./directory.service.js";

// ФШ-78: нийтийн сайтын "Багш нар". Нэвтрэлтгүй, утас имэйл өгөхгүй.
export const directoryPublicRouter = Router();

directoryPublicRouter.get("/public/teachers", async (_req, res) => {
  res.status(200).json(await listPublicTeachers());
});
