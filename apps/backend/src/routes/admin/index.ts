import { Router } from "express";
import { requireAuth, requireStaff } from "../../auth/middleware";
import { systemRouter } from "./system";
import { dashboardRouter } from "./dashboard";
import { usersRouter } from "./users";
import { meetingsRouter } from "./meetings";
import { recordingsRouter } from "./recordings";
import { roomsRouter } from "./rooms";

/**
 * Platform administration API. All routes require an authenticated staff user:
 * the guard sits on this router, mounted alone on /api/v1.0/admin, so it can
 * never leak onto other routes. One file per area of the console.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireStaff);
adminRouter.use(systemRouter);
adminRouter.use(dashboardRouter);
adminRouter.use(usersRouter);
adminRouter.use(meetingsRouter);
adminRouter.use(recordingsRouter);
adminRouter.use(roomsRouter);
