import type { CheckoutSessionDto, OrderDto, ShippingMethodDto } from "@thread/types";
import type {
  CheckoutAddressInput,
  CheckoutSessionCreateInput,
  CheckoutSettingsInput,
  CouponWriteInput,
  ShippingMethodWriteInput,
} from "@thread/validation";

import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import type { AuthContext } from "../auth/auth.types.js";
import { HttpError } from "../middleware/error-handler.js";
import type { CheckoutRepository, ReservationExpiryScheduler } from "./checkout.types.js";
import { hashIdempotencyKey } from "./repositories/mongoose-checkout.repository.js";
import type { NotificationService } from "../notifications/notification.service.js";

function validateIdempotencyKey(value: string): void {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(value))
    throw new HttpError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "A valid Idempotency-Key header is required.",
    );
}

export class CheckoutService {
  constructor(
    private readonly repository: CheckoutRepository,
    private readonly scheduler: ReservationExpiryScheduler,
    private readonly audits: AuditRepository,
    private readonly notifications?: Pick<NotificationService, "orderCreated">,
  ) {}

  bootstrap(userId: string) {
    return this.repository.bootstrap(userId);
  }

  adminConfiguration() {
    return this.repository.adminConfiguration();
  }

  async createAddress(userId: string, input: CheckoutAddressInput, context: AuthContext) {
    const address = await this.repository.createAddress(userId, input);
    await this.audit("checkout.address_created", userId, address.id, context);
    return address;
  }

  async createSession(
    userId: string,
    checkout: CheckoutSessionCreateInput,
    idempotencyKey: string,
    context: AuthContext,
  ): Promise<CheckoutSessionDto> {
    validateIdempotencyKey(idempotencyKey);
    const created = await this.repository.createSession({
      userId,
      idempotencyKeyHash: hashIdempotencyKey(idempotencyKey),
      checkout,
    });
    if (!created.reused && created.status === "active") {
      try {
        await this.scheduler.schedule(created.id, new Date(created.expiresAt));
      } catch (error) {
        await this.repository.releaseSession(created.id, "cancelled", userId);
        throw new HttpError(
          503,
          "RESERVATION_SCHEDULING_FAILED",
          error instanceof Error
            ? "Checkout could not safely reserve stock. Please try again."
            : "Checkout is temporarily unavailable.",
        );
      }
      await this.audit("checkout.session_created", userId, created.id, context, {
        totalPaise: created.totals.totalPaise,
      });
    }
    return created;
  }

  async getSession(userId: string, sessionId: string): Promise<CheckoutSessionDto> {
    const checkout = await this.repository.findSession(userId, sessionId);
    if (!checkout) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    if (checkout.status === "active" && new Date(checkout.expiresAt) <= new Date()) {
      const expired = await this.repository.releaseSession(sessionId, "expired", userId);
      return expired ?? checkout;
    }
    return checkout;
  }

  async cancel(
    userId: string,
    sessionId: string,
    context: AuthContext,
  ): Promise<CheckoutSessionDto> {
    const checkout = await this.repository.releaseSession(sessionId, "cancelled", userId);
    if (!checkout) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    await this.audit("checkout.session_cancelled", userId, sessionId, context);
    return checkout;
  }

  async expire(sessionId: string): Promise<void> {
    await this.repository.releaseSession(sessionId, "expired");
  }

  async confirmCod(
    userId: string,
    sessionId: string,
    idempotencyKey: string,
    context: AuthContext,
  ): Promise<OrderDto> {
    validateIdempotencyKey(idempotencyKey);
    const checkout = await this.getSession(userId, sessionId);
    if (checkout.paymentMethod !== "cod")
      throw new HttpError(400, "PAYMENT_METHOD_MISMATCH", "Checkout is not configured for COD.");
    const order = await this.repository.confirmSession({
      sessionId,
      confirmationIdempotencyKeyHash: hashIdempotencyKey(idempotencyKey),
      provider: "cod",
    });
    await this.audit("checkout.cod_order_confirmed", userId, order.id, context, {
      orderNumber: order.orderNumber,
    });
    await this.notifications?.orderCreated(order, userId);
    return order;
  }

  paymentFailed(sessionId: string): Promise<CheckoutSessionDto | null> {
    return this.repository.releaseSession(sessionId, "payment_failed");
  }

  listShippingMethods(): Promise<readonly ShippingMethodDto[]> {
    return this.repository.listShippingMethods(true);
  }

  async createShippingMethod(
    input: ShippingMethodWriteInput,
    actorId: string,
    context: AuthContext,
  ) {
    const method = await this.repository.createShippingMethod(input);
    await this.audit("checkout.shipping_method_created", actorId, method.id, context);
    return method;
  }

  async updateShippingMethod(
    id: string,
    input: Partial<ShippingMethodWriteInput>,
    actorId: string,
    context: AuthContext,
  ) {
    const method = await this.repository.updateShippingMethod(id, input);
    if (!method)
      throw new HttpError(404, "SHIPPING_METHOD_NOT_FOUND", "Shipping method not found.");
    await this.audit("checkout.shipping_method_updated", actorId, id, context);
    return method;
  }

  async createCoupon(input: CouponWriteInput, actorId: string, context: AuthContext) {
    const coupon = await this.repository.createCoupon(input);
    await this.audit("checkout.coupon_created", actorId, coupon.id, context);
    return coupon;
  }

  async updateCoupon(
    id: string,
    input: Partial<CouponWriteInput>,
    actorId: string,
    context: AuthContext,
  ) {
    const coupon = await this.repository.updateCoupon(id, input);
    if (!coupon) throw new HttpError(404, "COUPON_NOT_FOUND", "Coupon not found.");
    await this.audit("checkout.coupon_updated", actorId, id, context);
    return coupon;
  }

  async updateSettings(input: CheckoutSettingsInput, actorId: string, context: AuthContext) {
    const settings = await this.repository.updateSettings(input);
    await this.audit("checkout.settings_updated", actorId, "default", context);
    return settings;
  }

  private audit(
    action: string,
    actorId: string,
    entityId: string,
    context: AuthContext,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.audits.record({
      action,
      actorId,
      context,
      entity: "checkout",
      entityId,
      ...(metadata ? { metadata } : {}),
    });
  }
}
