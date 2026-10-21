import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";

// Модуль бүрийн route-ууд тухайн модулийг хийх үедээ энд холбогдоно.
export const apiV1Router = Router();

apiV1Router.use(authRouter);
