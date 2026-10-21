import { Router } from "express";
import { prisma } from "./db/prisma.js";

export const healthRouter = Router();

// Гадаад мониторинг 5 минут тутамд үзнэ (ФБШ-14), DB-гүй үед 503.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", db: "error" });
  }
});
