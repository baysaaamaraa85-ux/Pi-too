import { Router } from "express";
import { authenticate } from "../../shared/rbac/authenticate.js";
import { authorize } from "../../shared/rbac/authorize.js";
import * as controller from "./placement.controller.js";

// D-102: түвшин тогтоох хүсэлт ба салбарын ахлагч. Админ бүгдийг, багш (ахлагч, эсвэл хүсэлт шилжүүлж авсан) өөрийнхийг.
// Эзэмшлийг service шалгана (BOLA). enrollmentRouter-ийн ADMIN/TEACHER хаалтаас өмнө холбогдоно, үүргээ route бүр дээр заана.
export const placementRouter = Router();

placementRouter.get("/placement-requests", authenticate, authorize("ADMIN"), controller.listPlacementRequests);
placementRouter.get("/teacher/placement-requests", authenticate, authorize("TEACHER"), controller.listMyPlacementRequests);
placementRouter.patch(
  "/placement-requests/:id",
  authenticate,
  authorize("ADMIN", "TEACHER"),
  controller.updatePlacementRequest,
);
placementRouter.get(
  "/placement-requests/:id/forward-candidates",
  authenticate,
  authorize("TEACHER"),
  controller.listForwardCandidates,
);
placementRouter.post(
  "/placement-requests/:id/forward",
  authenticate,
  authorize("TEACHER"),
  controller.forwardPlacementRequest,
);
placementRouter.put("/branches/:id/lead", authenticate, authorize("ADMIN"), controller.setBranchLead);
