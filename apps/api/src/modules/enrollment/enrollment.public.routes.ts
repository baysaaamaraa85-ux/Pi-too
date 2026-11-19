import { Router } from "express";
import { rateLimit } from "../../shared/rate-limit.js";
import * as controller from "./placement.controller.js";

// Нэвтрэлтгүй цорын ганц бизнес endpoint: нийтийн сайтын "Холбогдох" маягт
// (design 8.1-ийн жагсаалтад 2026.10.22-ны шийдвэрээр нэмэгдсэн). Спамаас
// хамгаалж нэг IP-аас 10 минутад 5 хүсэлт.
export const enrollmentPublicRouter = Router();

enrollmentPublicRouter.post(
  "/public/placement-requests",
  rateLimit({ windowMs: 10 * 60 * 1000, limit: 5 }),
  controller.createPlacementRequest,
);
