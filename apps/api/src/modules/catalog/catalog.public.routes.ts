import { Router } from "express";
import { getPublicOverview, listBranches, listPrograms } from "./catalog.service.js";

// ФШ-78: нийтийн сайтад нэвтрэлтгүй өгөх мэдээлэл (хөтөлбөр, үнэ, салбар, журмын гол тоо).
// Утас, цалин, сурагчийн мэдээлэл энд орохгүй.
export const catalogPublicRouter = Router();

catalogPublicRouter.get("/public/branches", async (_req, res) => {
  const branches = await listBranches();
  res.status(200).json(
    branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      description: b.description,
      phones: b.phones,
      photoUrl: b.photoUrl,
    })),
  );
});

catalogPublicRouter.get("/public/programs", async (_req, res) => {
  const programs = await listPrograms();
  res.status(200).json(programs.map((p) => ({ id: p.id, name: p.name, price: p.currentPrice.toFixed(2) })));
});

// Нүүр хуудасны тоон мэдээлэл: журмын утгуудыг (settings) кодонд биш өгөгдлийн сангаас авна.
catalogPublicRouter.get("/public/overview", async (_req, res) => {
  res.status(200).json(await getPublicOverview());
});
