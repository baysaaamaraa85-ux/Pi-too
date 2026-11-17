import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { enrollmentPublicRouter } from "./modules/enrollment/enrollment.public.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { catalogPublicRouter } from "./modules/catalog/catalog.public.routes.js";
import { directoryPublicRouter } from "./modules/directory/directory.public.routes.js";
import { schedulingRouter } from "./modules/scheduling/scheduling.routes.js";
import { enrollmentRouter } from "./modules/enrollment/enrollment.routes.js";
import { attendanceRouter } from "./modules/attendance/attendance.routes.js";
import { directoryRouter } from "./modules/directory/directory.routes.js";
import { payrollRouter } from "./modules/payroll/payroll.routes.js";
import { progressRouter } from "./modules/progress/progress.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { paymentsRouter } from "./modules/payments/payments.routes.js";
import { portalRouter } from "./modules/portal/portal.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { transferRouter } from "./modules/transfer/transfer.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";

// Модуль бүрийн route-ууд тухайн модулийг хийх үедээ энд холбогдоно.
export const apiV1Router = Router();

apiV1Router.use(authRouter);
// Нийтийн (нэвтрэлтгүй) route нь authenticate-тай router-уудаас өмнө байрлана.
apiV1Router.use(enrollmentPublicRouter);
apiV1Router.use(catalogPublicRouter);
apiV1Router.use(directoryPublicRouter);
apiV1Router.use(catalogRouter);
apiV1Router.use(schedulingRouter);
// attendance, portal нь эцэг эх, сурагчийн route тул "ADMIN, TEACHER"-ийг router
// даяар шаарддаг enrollmentRouter-ээс ӨМНӨ холбогдоно (эс бөгөөс 403 авна).
apiV1Router.use(attendanceRouter);
apiV1Router.use(portalRouter);
// directory: GET /parents (?phone=) enrollmentRouter-ийн ADMIN/TEACHER хаалтаас өмнө.
apiV1Router.use(directoryRouter);
apiV1Router.use(payrollRouter);
apiV1Router.use(progressRouter);
apiV1Router.use(paymentsRouter);
apiV1Router.use(notificationsRouter);
apiV1Router.use(reportsRouter);
apiV1Router.use(transferRouter);
// D-69: багшийн өөрийн категори (зөвхөн TEACHER).
apiV1Router.use(categoriesRouter);
apiV1Router.use(enrollmentRouter);
