import cookieParser from "cookie-parser";
import express from "express";
import { apiV1Router } from "./api-v1.router.js";
import { notFoundHandler, problemDetails } from "./shared/errors/problem-details.js";
import { healthRouter } from "./shared/health.js";
import { requestLogger } from "./shared/request-logger.js";

export function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());

  app.use(healthRouter);
  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(problemDetails);

  return app;
}
