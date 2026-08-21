import { Router, type Request, type RequestHandler } from "express";
import { orderStatusUpdateSchema } from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import {
  createOriginGuard,
  requireCsrf,
  requireRoles,
  validateBody,
} from "../auth/http/security.middleware.js";
import type { NotificationService } from "./notification.service.js";

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function context(request: Request): AuthContext {
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    requestId: request.requestId,
    ...(request.header("user-agent")
      ? { userAgent: request.header("user-agent")!.slice(0, 512) }
      : {}),
  };
}

export function createNotificationRouter(
  service: NotificationService,
  authenticate: RequestHandler,
  webOrigin: string,
): Router {
  const router = Router();
  const mutations = [createOriginGuard(webOrigin), requireCsrf];
  router.use("/notifications", authenticate);
  router.use("/orders", authenticate);

  router.get("/notifications", async (request, response) =>
    response.json({
      success: true,
      data: await service.list(
        request.auth!.userId,
        typeof request.query.cursor === "string" ? request.query.cursor : undefined,
      ),
    }),
  );
  router.post("/notifications/:id/read", ...mutations, async (request, response) =>
    response.json({
      success: true,
      data: await service.markRead(request.auth!.userId, parameter(request, "id")),
    }),
  );
  router.get("/orders", async (request, response) =>
    response.json({ success: true, data: await service.orders(request.auth!.userId) }),
  );
  router.get(
    "/orders/admin",
    requireRoles("super_admin", "admin", "order_manager", "support_agent"),
    async (_request, response) =>
      response.json({ success: true, data: await service.adminOrders() }),
  );
  router.get("/orders/:id/tracking", async (request, response) =>
    response.json({
      success: true,
      data: await service.tracking(request.auth!.userId, parameter(request, "id")),
    }),
  );
  router.get("/orders/:id/invoice", async (request, response) => {
    const content = await service.invoice(request.auth!.userId, parameter(request, "id"));
    response
      .set({
        "cache-control": "private, no-store",
        "content-disposition": 'attachment; filename="thread-invoice.pdf"',
        "content-type": "application/pdf",
      })
      .send(content);
  });
  router.patch(
    "/orders/admin/:id/status",
    ...mutations,
    requireRoles("super_admin", "admin", "order_manager"),
    validateBody(orderStatusUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateOrderStatus(
          parameter(request, "id"),
          request.auth!.userId,
          request.body,
          context(request),
        ),
      }),
  );
  return router;
}
