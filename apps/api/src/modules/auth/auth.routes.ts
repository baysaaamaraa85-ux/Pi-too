import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./auth.controller.js";

// Express 5: async handler-ийн reject автоматаар error middleware-рүү дамжина.
export const authRouter = Router();

authRouter.post("/auth/login", controller.login);
authRouter.post("/auth/refresh", controller.refresh);
authRouter.post("/auth/logout", controller.logout);
authRouter.post("/auth/password/change", authenticate, controller.changePassword);
authRouter.post("/auth/password/forgot", controller.forgotPassword);
authRouter.post("/auth/password/reset", controller.resetPassword);

authRouter.post("/users", authenticate, authorize("ADMIN"), controller.createUser);
authRouter.patch(
  "/users/:id/status",
  authenticate,
  authorize("ADMIN"),
  controller.updateUserStatus,
);
