import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";

// Модуль бүрийн route-ууд тухайн модулийг хийх үедээ энд холбогдоно.
export const apiV1Router = Router();

apiV1Router.use(authRouter);
apiV1Router.use(catalogRouter);
