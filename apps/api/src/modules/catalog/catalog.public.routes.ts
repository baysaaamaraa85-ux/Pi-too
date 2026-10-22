import { Router } from "express";
import { listBranches } from "./catalog.service.js";

// Нийтийн сайтын "Холбогдох" маягтад салбар сонгуулахад зөвхөн id, нэрийг
// нэвтрэлтгүй өгнө (хаяг, бусад мэдээлэл өгөхгүй).
export const catalogPublicRouter = Router();

catalogPublicRouter.get("/public/branches", async (_req, res) => {
  const branches = await listBranches();
  res.status(200).json(branches.map((b) => ({ id: b.id, name: b.name })));
});
