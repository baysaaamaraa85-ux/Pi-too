import cookieParser from "cookie-parser";
import express from "express";
import { apiV1Router } from "./api-v1.router.js";
import { notFoundHandler, problemDetails } from "./shared/errors/problem-details.js";
import { healthRouter } from "./shared/health.js";
import { requestLogger } from "./shared/request-logger.js";
import { UPLOAD_ROOT } from "./shared/uploads/image-upload.js";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());

  app.use(healthRouter);
  // ФШ-78: багш, салбарын зураг. Нэр нь UUID тул кэшлэхэд аюулгүй; хөтөч төрлийг таамаглахгүй (nosniff).
  app.use(
    "/uploads",
    express.static(UPLOAD_ROOT, {
      maxAge: "7d",
      index: false,
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    }),
  );
  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(problemDetails);

  return app;
}
