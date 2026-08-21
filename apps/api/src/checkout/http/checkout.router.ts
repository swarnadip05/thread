import { Router, type Request, type RequestHandler } from "express";
import {
  checkoutAddressSchema,
  checkoutSessionCreateSchema,
  checkoutSettingsSchema,
  couponPatchSchema,
  couponWriteSchema,
  shippingMethodPatchSchema,
  shippingMethodWriteSchema,
} from "@thread/validation";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  createOriginGuard,
  requireCsrf,
  requireRoles,
  validateBody,
} from "../../auth/http/security.middleware.js";
import { HttpError } from "../../middleware/error-handler.js";
import type { CheckoutService } from "../checkout.service.js";

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

export function createCheckoutRouter(
  service: CheckoutService,
  authenticate: RequestHandler,
  webOrigin: string,
): Router {
  const router = Router();
  const mutationSecurity = [createOriginGuard(webOrigin), requireCsrf];
  const adminRoles = requireRoles("super_admin", "admin", "order_manager");
  const configurationReaders = requireRoles(
    "super_admin",
    "admin",
    "order_manager",
    "catalog_manager",
  );
  const couponRoles = requireRoles("super_admin", "admin", "catalog_manager");

  router.use("/checkout", authenticate);
  router.get("/checkout/bootstrap", async (request, response) =>
    response.json({ success: true, data: await service.bootstrap(request.auth!.userId) }),
  );
  router.post(
    "/checkout/addresses",
    ...mutationSecurity,
    validateBody(checkoutAddressSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createAddress(request.auth!.userId, request.body, context(request)),
      }),
  );
  router.post(
    "/checkout/sessions",
    ...mutationSecurity,
    validateBody(checkoutSessionCreateSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createSession(
          request.auth!.userId,
          request.body,
          idempotencyKey(request),
          context(request),
        ),
      }),
  );
  router.get("/checkout/sessions/:id", async (request, response) =>
    response.json({
      success: true,
      data: await service.getSession(request.auth!.userId, parameter(request, "id")),
    }),
  );
  router.post("/checkout/sessions/:id/cancel", ...mutationSecurity, async (request, response) =>
    response.json({
      success: true,
      data: await service.cancel(request.auth!.userId, parameter(request, "id"), context(request)),
    }),
  );
  router.post(
    "/checkout/sessions/:id/confirm-cod",
    ...mutationSecurity,
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.confirmCod(
          request.auth!.userId,
          parameter(request, "id"),
          idempotencyKey(request),
          context(request),
        ),
      }),
  );

  router.get("/checkout/admin/configuration", configurationReaders, async (_request, response) =>
    response.json({ success: true, data: await service.adminConfiguration() }),
  );
  router.post(
    "/checkout/admin/shipping-methods",
    ...mutationSecurity,
    adminRoles,
    validateBody(shippingMethodWriteSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createShippingMethod(
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.patch(
    "/checkout/admin/shipping-methods/:id",
    ...mutationSecurity,
    adminRoles,
    validateBody(shippingMethodPatchSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateShippingMethod(
          parameter(request, "id"),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post(
    "/checkout/admin/coupons",
    ...mutationSecurity,
    couponRoles,
    validateBody(couponWriteSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.createCoupon(request.body, request.auth!.userId, context(request)),
      }),
  );
  router.patch(
    "/checkout/admin/coupons/:id",
    ...mutationSecurity,
    couponRoles,
    validateBody(couponPatchSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateCoupon(
          parameter(request, "id"),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.patch(
    "/checkout/admin/settings",
    ...mutationSecurity,
    adminRoles,
    validateBody(checkoutSettingsSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateSettings(request.body, request.auth!.userId, context(request)),
      }),
  );
  return router;
}
