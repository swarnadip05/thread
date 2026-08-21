import type { RequestHandler, Router } from "express";

import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import { MongooseAdminDashboardRepository } from "./dashboard.repository.js";
import { createAdminDashboardRouter } from "./dashboard.router.js";
import { AdminDashboardService } from "./dashboard.service.js";

export function composeAdminDashboard(authenticate: RequestHandler): Router {
  return createAdminDashboardRouter(
    new AdminDashboardService(new MongooseAdminDashboardRepository()),
    new MongooseAuditRepository(),
    authenticate,
  );
}
