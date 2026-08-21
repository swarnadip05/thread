import { describe, expect, it } from "vitest";
import type {
  CheckoutAddressDto,
  CheckoutAdminDto,
  CheckoutBootstrapDto,
  CheckoutSessionDto,
  OrderDto,
  ShippingMethodDto,
} from "@thread/types";
import type {
  CheckoutAddressInput,
  CheckoutSessionCreateInput,
  CheckoutSettingsInput,
  CouponWriteInput,
  ShippingMethodWriteInput,
} from "@thread/validation";

import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import { CheckoutService } from "../src/checkout/checkout.service.js";
import type {
  CheckoutRepository,
  ReservationExpiryScheduler,
} from "../src/checkout/checkout.types.js";
import { HttpError } from "../src/middleware/error-handler.js";

const userId = "507f1f77bcf86cd799439011";
const variantId = "507f1f77bcf86cd799439012";
const addressId = "507f1f77bcf86cd799439013";
const shippingMethodId = "507f1f77bcf86cd799439014";
const context = { requestId: "checkout-test" };
const shipping: ShippingMethodDto = {
  id: shippingMethodId,
  name: "Manual standard",
  description: "Configured manual shipping",
  ratePaise: 10_000,
  codEligible: false,
  active: true,
  sortOrder: 1,
};
const address: CheckoutAddressDto = {
  id: addressId,
  fullName: "Test Customer",
  phone: "+919999999999",
  addressLine1: "Test address",
  city: "Kolkata",
  district: "North 24 Parganas",
  state: "West Bengal",
  postalCode: "700159",
  country: "India",
  type: "home",
  isDefault: true,
};
const baseCheckout: CheckoutSessionCreateInput = {
  addressId,
  shippingMethodId,
  paymentMethod: "payment_placeholder",
  codConfirmationAccepted: false,
  policyAccepted: true,
  lines: [{ variantId, quantity: 2, observedUnitPricePaise: 80_000 }],
};

class MemoryCheckoutRepository implements CheckoutRepository {
  stockOnHand = 3;
  stockReserved = 0;
  currentPricePaise = 90_000;
  sessions = new Map<string, CheckoutSessionDto>();
  keys = new Map<string, string>();

  async bootstrap(): Promise<CheckoutBootstrapDto> {
    return {
      addresses: [address],
      shippingMethods: [shipping],
      reservationMinutes: 12,
      guestCheckoutEnabled: false,
      codEnabled: false,
      codConfirmationRequired: true,
    };
  }
  async adminConfiguration(): Promise<CheckoutAdminDto> {
    return {
      shippingMethods: [shipping],
      coupons: [],
      settings: {
        reservationMinutes: 12,
        guestCheckoutEnabled: false,
        codEnabled: false,
        codMinimumOrderPaise: 0,
        codMaximumOrderPaise: null,
        codPostalPrefixes: [],
        codConfirmationRequired: true,
      },
    };
  }
  async createAddress(_userId: string, _input: CheckoutAddressInput) {
    return address;
  }
  async createSession(input: {
    userId: string;
    idempotencyKeyHash: string;
    checkout: CheckoutSessionCreateInput;
  }): Promise<CheckoutSessionDto> {
    await Promise.resolve();
    const existingId = this.keys.get(input.idempotencyKeyHash);
    if (existingId) return { ...this.sessions.get(existingId)!, reused: true };
    if (input.checkout.couponCode === "INVALID")
      throw new HttpError(400, "INVALID_COUPON", "Coupon is invalid or unavailable.");
    const quantity = input.checkout.lines[0]!.quantity;
    if (this.stockOnHand - this.stockReserved < quantity)
      throw new HttpError(409, "INSUFFICIENT_STOCK", "Not enough stock.");
    this.stockReserved += quantity;
    const subtotalPaise = quantity * this.currentPricePaise;
    const session: CheckoutSessionDto = {
      id: `507f1f77bcf86cd7994390${15 + this.sessions.size}`,
      status: "active",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      address,
      shippingMethod: shipping,
      items: [
        {
          productId: userId,
          variantId,
          sku: "TH-TEST-M",
          title: "THREAD Test Tee",
          slug: "thread-test-tee",
          colour: "Ink",
          size: "M",
          quantity,
          mrpPaise: 100_000,
          unitPricePaise: this.currentPricePaise,
          lineSubtotalPaise: subtotalPaise,
          taxPaise: 0,
          priceChanged: input.checkout.lines[0]!.observedUnitPricePaise !== this.currentPricePaise,
        },
      ],
      totals: {
        subtotalPaise,
        discountPaise: 0,
        shippingPaise: shipping.ratePaise,
        taxPaise: 0,
        totalPaise: subtotalPaise + shipping.ratePaise,
      },
      paymentMethod: input.checkout.paymentMethod,
      policyAcceptedAt: new Date().toISOString(),
      reused: false,
    };
    this.keys.set(input.idempotencyKeyHash, session.id);
    this.sessions.set(session.id, session);
    return session;
  }
  async findSession(_userId: string, sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }
  async validateSessionPayable(_userId: string, sessionId: string) {
    const checkout = this.sessions.get(sessionId);
    if (!checkout) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    return checkout;
  }
  async preparePendingOrder(_userId: string, sessionId: string): Promise<OrderDto> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new HttpError(404, "CHECKOUT_NOT_FOUND", "Checkout not found.");
    return {
      id: "507f1f77bcf86cd799439099",
      orderNumber: "THR-2026-000001",
      status: "pending_payment",
      items: session.items,
      totals: session.totals,
      address: session.address,
      shippingMethod: session.shippingMethod,
      paymentMethod: session.paymentMethod,
      createdAt: new Date().toISOString(),
    };
  }
  async findOrderById(_orderId: string): Promise<OrderDto | null> {
    return null;
  }
  async releaseSession(sessionId: string, reason: "expired" | "cancelled" | "payment_failed") {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.status !== "active") return session;
    const quantity = session.items.reduce((sum, item) => sum + item.quantity, 0);
    this.stockReserved -= quantity;
    const released: CheckoutSessionDto = {
      ...session,
      status:
        reason === "expired"
          ? "expired"
          : reason === "payment_failed"
            ? "payment_failed"
            : "cancelled",
    };
    this.sessions.set(sessionId, released);
    return released;
  }
  async confirmSession(input: { sessionId: string }): Promise<OrderDto> {
    const session = this.sessions.get(input.sessionId);
    if (!session || session.status !== "active")
      throw new HttpError(409, "CHECKOUT_NOT_ACTIVE", "Checkout is inactive.");
    const quantity = session.items.reduce((sum, item) => sum + item.quantity, 0);
    this.stockOnHand -= quantity;
    this.stockReserved -= quantity;
    this.sessions.set(session.id, { ...session, status: "converted" });
    return {
      id: "507f1f77bcf86cd799439099",
      orderNumber: "THR-2026-000001",
      status: "confirmed",
      items: session.items,
      totals: session.totals,
      address: session.address,
      shippingMethod: session.shippingMethod,
      paymentMethod: session.paymentMethod,
      createdAt: new Date().toISOString(),
    };
  }
  async listShippingMethods(): Promise<readonly ShippingMethodDto[]> {
    return [shipping];
  }
  async createShippingMethod(_input: ShippingMethodWriteInput) {
    return shipping;
  }
  async updateShippingMethod(_id: string, _input: Partial<ShippingMethodWriteInput>) {
    return shipping;
  }
  async createCoupon(_input: CouponWriteInput) {
    return { id: userId, code: "TEST" };
  }
  async updateCoupon(_id: string, _input: Partial<CouponWriteInput>) {
    return { id: userId, code: "TEST" };
  }
  async updateSettings(input: CheckoutSettingsInput) {
    return input;
  }
}

class MemoryScheduler implements ReservationExpiryScheduler {
  scheduled: string[] = [];
  async schedule(sessionId: string): Promise<void> {
    this.scheduled.push(sessionId);
  }
}
const audits: AuditRepository = { record: async () => undefined };

function setup() {
  const repository = new MemoryCheckoutRepository();
  const scheduler = new MemoryScheduler();
  return {
    repository,
    scheduler,
    service: new CheckoutService(repository, scheduler, audits),
  };
}

describe("checkout stock and idempotency", () => {
  it("allows only one of two concurrent attempts when stock is insufficient for both", async () => {
    const { repository, service } = setup();
    const results = await Promise.allSettled([
      service.createSession(userId, baseCheckout, "attempt-one", context),
      service.createSession(userId, baseCheckout, "attempt-two", context),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(repository.stockReserved).toBe(2);
  });

  it("reuses a duplicate idempotency key without reserving twice", async () => {
    const { repository, scheduler, service } = setup();
    const first = await service.createSession(userId, baseCheckout, "same-attempt", context);
    const repeated = await service.createSession(userId, baseCheckout, "same-attempt", context);
    expect(repeated.id).toBe(first.id);
    expect(repeated.reused).toBe(true);
    expect(repository.stockReserved).toBe(2);
    expect(scheduler.scheduled).toHaveLength(1);
  });

  it("releases reserved stock when the delayed expiry handler runs", async () => {
    const { repository, service } = setup();
    const checkout = await service.createSession(userId, baseCheckout, "expiry-test", context);
    await service.expire(checkout.id);
    expect(repository.stockReserved).toBe(0);
    expect(repository.sessions.get(checkout.id)?.status).toBe("expired");
  });

  it("rejects an invalid coupon without reserving stock", async () => {
    const { repository, service } = setup();
    await expect(
      service.createSession(
        userId,
        { ...baseCheckout, couponCode: "INVALID" },
        "coupon-test",
        context,
      ),
    ).rejects.toMatchObject({ code: "INVALID_COUPON", statusCode: 400 });
    expect(repository.stockReserved).toBe(0);
  });

  it("uses the current server price and reports a changed cart price", async () => {
    const { service } = setup();
    const checkout = await service.createSession(userId, baseCheckout, "price-test", context);
    expect(checkout.items[0]).toMatchObject({
      unitPricePaise: 90_000,
      priceChanged: true,
    });
    expect(checkout.totals.subtotalPaise).toBe(180_000);
  });
});
