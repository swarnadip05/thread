import express, { Router, type Request, type RequestHandler } from "express";
import { adminRefundSchema, paymentCallbackSchema } from "@thread/validation";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  createOriginGuard,
  requireCsrf,
  requireRoles,
  validateBody,
} from "../../auth/http/security.middleware.js";
import { HttpError } from "../../middleware/error-handler.js";
import type { PaymentService } from "../payment.service.js";

function context(request: Request): AuthContext {
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    requestId: request.requestId,
    ...(request.header("user-agent")
      ? { userAgent: request.header("user-agent")!.slice(0, 512) }
      : {}),
  };
}

function parameter(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function idempotencyKey(request: Request): string {
  const value = request.header("idempotency-key");
  if (!value)
    throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header is required.");
  return value;
}

export function createPaymentRouter(
  service: PaymentService,
  authenticate: RequestHandler,
  webOrigin: string,
): Router {
  const router = Router();
  const mutationSecurity = [createOriginGuard(webOrigin), requireCsrf];
  router.use("/payments", authenticate);
  router.post(
    "/payments/checkout-sessions/:id/create",
    ...mutationSecurity,
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createPayment(
          request.auth!.userId,
          parameter(request, "id"),
          idempotencyKey(request),
          context(request),
        ),
      }),
  );
  router.post(
    "/payments/checkout-sessions/:id/callback",
    ...mutationSecurity,
    validateBody(paymentCallbackSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.verifyClientCallback(
          request.auth!.userId,
          parameter(request, "id"),
          request.body,
          context(request),
        ),
      }),
  );
  router.get("/payments/checkout-sessions/:id/status", async (request, response) =>
    response.json({
      success: true,
      data: await service.getStatus(request.auth!.userId, parameter(request, "id")),
    }),
  );
  router.post(
    "/payments/checkout-sessions/:id/mock-complete",
    ...mutationSecurity,
    async (request, response) =>
      response.json({
        success: true,
        data: await service.completeMockPayment(
          request.auth!.userId,
          parameter(request, "id"),
          context(request),
        ),
      }),
  );
  router.post(
    "/payments/admin/orders/:id/refund",
    ...mutationSecurity,
    requireRoles("super_admin", "admin", "order_manager"),
    validateBody(adminRefundSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.refundOrder(
          request.auth!.userId,
          parameter(request, "id"),
          request.body,
          context(request),
        ),
      }),
  );
  return router;
}

export function createPaymentWebhookRouter(service: PaymentService): Router {
  const router = Router();
  router.post(
    "/payments/webhooks/razorpay",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (request, response) => {
      if (!Buffer.isBuffer(request.body))
        throw new HttpError(400, "WEBHOOK_INVALID", "Webhook body must be raw JSON.");
      const signature = request.header("x-razorpay-signature");
      if (!signature)
        throw new HttpError(400, "WEBHOOK_SIGNATURE_REQUIRED", "Webhook signature is required.");
      const result = await service.handleWebhook(
        request.body,
        signature,
        request.header("x-razorpay-event-id"),
      );
      response.status(200).json({ success: true, data: result });
    },
  );
  return router;
}
