import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// ФШ-63: админ хүргэгдээгүй мэдэгдлийг харж, дахин илгээнэ.
notificationsRouter.get("/notifications", authorize("ADMIN"), controller.listNotifications);
notificationsRouter.post("/notifications/:id/retry", authorize("ADMIN"), controller.retryNotification);
// Хүлээн авагч өөрийн төхөөрөмж дээр хүрсэнийг баталгаажуулна (service worker).
notificationsRouter.post("/notifications/:id/ack", authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"), controller.acknowledge);

// ФШ-62: push бүртгэл, суваг сонголт.
notificationsRouter.post("/push-subscriptions", authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"), controller.subscribePush);
notificationsRouter.delete("/push-subscriptions", authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"), controller.unsubscribePush);
notificationsRouter.get("/me/notification-settings", authorize("ADMIN", "TEACHER", "PARENT", "STUDENT"), controller.getSettings);
notificationsRouter.put("/me/notification-settings", authorize("PARENT"), controller.updateSettings);
