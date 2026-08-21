import { Router, type Request, type RequestHandler } from "express";
import { adminDashboardQuerySchema } from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import { requireRoles } from "../auth/http/security.middleware.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import { HttpError } from "../middleware/error-handler.js";
import type { AdminDashboardService } from "./dashboard.service.js";

function context(request: Request): AuthContext {
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    requestId: request.requestId,
    ...(request.header("user-agent")
      ? { userAgent: request.header("user-agent")!.slice(0, 512) }
      : {}),
  };
}

function query(request: Request) {
  const result = adminDashboardQuerySchema.safeParse(request.query);
  if (!result.success)
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Dashboard filters are invalid.",
    );
  return result.data;
}

function csvCell(value: string | number): string {
  const text = String(value).replaceAll('"', '""');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe}"`;
}

export function createAdminDashboardRouter(
  service: AdminDashboardService,
  audits: AuditRepository,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(
    "/admin/dashboard",
    authenticate,
    requireRoles("super_admin", "admin", "order_manager"),
  );
  router.get("/admin/dashboard", async (request, response) =>
    response.json({ success: true, data: await service.get(query(request)) }),
  );
  router.get("/admin/dashboard/export", async (request, response) => {
    const dashboard = await service.get(query(request));
    const rows = [
      ["Order number", "Created at", "Order status", "Payment status", "Items", "Total paise"],
      ...dashboard.recentOrders.map((order) => [
        order.orderNumber,
        order.createdAt,
        order.status,
        order.paymentStatus,
        order.itemCount,
        order.totalPaise,
      ]),
    ];
    await audits.record({
      action: "admin.dashboard_exported",
      actorId: request.auth!.userId,
      context: context(request),
      entity: "dashboard",
      metadata: { from: dashboard.range.from, to: dashboard.range.to },
    });
    response
      .set({
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="thread-dashboard-orders.csv"',
        "content-type": "text/csv; charset=utf-8",
      })
      .send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
  });
  return router;
}
