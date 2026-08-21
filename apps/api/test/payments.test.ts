import { describe, expect, it } from "vitest";
import type {
  CheckoutAddressDto,
  CheckoutAdminDto,
  CheckoutBootstrapDto,
  CheckoutSessionDto,
  OrderDto,
  PaymentProviderKind,
  RefundDto,
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
import type { CheckoutRepository } from "../src/checkout/checkout.types.js";
import { loadApiConfig } from "../src/config/env.js";
import { HttpError } from "../src/middleware/error-handler.js";
import { PaymentService } from "../src/payments/payment.service.js";
import type {
  PaymentOrderPreparation,
  PaymentRepository,
  PaymentView,
} from "../src/payments/payment.types.js";
import { MockPaymentProvider } from "../src/payments/providers/mock-payment.provider.js";
import type {
  PaymentProvider,
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
} from "../src/payments/providers/payment.provider.js";
import {
  paymentSignature,
  verifyPaymentSignature,
  webhookSignature,
} from "../src/payments/providers/signatures.js";

const userId = "507f1f77bcf86cd799439011";
const sessionId = "507f1f77bcf86cd799439012";
const orderId = "507f1f77bcf86cd799439013";
const paymentId = "507f1f77bcf86cd799439014";
const providerSecret = "test-provider-secret";
const providerWebhookSecret = "test-webhook-secret";
const context = { requestId: "payment-test" };
const address: CheckoutAddressDto = {
  id: "507f1f77bcf86cd799439015",
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
const shipping: ShippingMethodDto = {
  id: "507f1f77bcf86cd799439016",
  name: "Configured shipping",
  description: "Configured by test",
  ratePaise: 10_000,
  codEligible: false,
  active: true,
  sortOrder: 1,
};
const checkout: CheckoutSessionDto = {
  id: sessionId,
  status: "active",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  address,
  shippingMethod: shipping,
  items: [
    {
      productId: "507f1f77bcf86cd799439017",
      variantId: "507f1f77bcf86cd799439018",
      sku: "TH-TEST-M",
      title: "THREAD Test Tee",
      slug: "thread-test-tee",
      colour: "Ink",
      size: "M",
      quantity: 1,
      mrpPaise: 100_000,
      unitPricePaise: 90_000,
      lineSubtotalPaise: 90_000,
      taxPaise: 0,
      priceChanged: false,
    },
  ],
  totals: {
    subtotalPaise: 90_000,
    discountPaise: 0,
    shippingPaise: 10_000,
    taxPaise: 0,
    totalPaise: 100_000,
  },
  paymentMethod: "payment_placeholder",
  policyAcceptedAt: new Date().toISOString(),
  reused: false,
};

class MemoryCheckoutRepository implements CheckoutRepository {
  orderStatus: OrderDto["status"] = "pending_payment";
  confirmCount = 0;
  releaseCount = 0;
  onConfirm?: (providerPaymentId: string) => void;

  order(): OrderDto {
    return {
      id: orderId,
      orderNumber: "THR-2026-000001",
      status: this.orderStatus,
      items: checkout.items,
      totals: checkout.totals,
      address,
      shippingMethod: shipping,
      paymentMethod: "payment_placeholder",
      createdAt: new Date().toISOString(),
    };
  }

  async bootstrap(): Promise<CheckoutBootstrapDto> {
    throw new Error("Not used");
  }
  async adminConfiguration(): Promise<CheckoutAdminDto> {
    throw new Error("Not used");
  }
  async createAddress(_userId: string, _input: CheckoutAddressInput): Promise<CheckoutAddressDto> {
    throw new Error("Not used");
  }
  async createSession(_input: {
    userId: string;
    idempotencyKeyHash: string;
    checkout: CheckoutSessionCreateInput;
  }): Promise<CheckoutSessionDto> {
    throw new Error("Not used");
  }
  async findSession(): Promise<CheckoutSessionDto | null> {
    return checkout;
  }
  async validateSessionPayable(): Promise<CheckoutSessionDto> {
    return checkout;
  }
  async preparePendingOrder(): Promise<OrderDto> {
    return this.order();
  }
  async findOrderById(): Promise<OrderDto | null> {
    return this.order();
  }
  async releaseSession(): Promise<CheckoutSessionDto> {
    if (this.orderStatus !== "confirmed") this.releaseCount += 1;
    return { ...checkout, status: "payment_failed" };
  }
  async confirmSession(input: { providerPaymentId?: string }): Promise<OrderDto> {
    if (this.orderStatus !== "confirmed") {
      this.confirmCount += 1;
      this.orderStatus = "confirmed";
      if (input.providerPaymentId) this.onConfirm?.(input.providerPaymentId);
    }
    return this.order();
  }
  async listShippingMethods(): Promise<readonly ShippingMethodDto[]> {
    return [];
  }
  async createShippingMethod(_input: ShippingMethodWriteInput): Promise<ShippingMethodDto> {
    throw new Error("Not used");
  }
  async updateShippingMethod(
    _id: string,
    _input: Partial<ShippingMethodWriteInput>,
  ): Promise<ShippingMethodDto | null> {
    throw new Error("Not used");
  }
  async createCoupon(_input: CouponWriteInput): Promise<{ id: string; code: string }> {
    throw new Error("Not used");
  }
  async updateCoupon(
    _id: string,
    _input: Partial<CouponWriteInput>,
  ): Promise<{ id: string; code: string } | null> {
    throw new Error("Not used");
  }
  async updateSettings(_input: CheckoutSettingsInput): Promise<CheckoutSettingsInput> {
    throw new Error("Not used");
  }
}

class MemoryPaymentRepository implements PaymentRepository {
  payment: PaymentView | null = null;
  refund: RefundDto | null = null;
  events = new Set<string>();

  async getCheckoutIdentity() {
    return { brandName: "THREAD", name: "Test Customer", email: "test@example.com" };
  }
  async acquireProviderOrderCreation(input: {
    provider: PaymentProviderKind;
    idempotencyKeyHash: string;
  }): Promise<PaymentOrderPreparation> {
    if (this.payment?.providerOrderId) return { payment: this.payment };
    this.payment = {
      id: paymentId,
      checkoutSessionId: sessionId,
      orderId,
      userId,
      provider: input.provider,
      amountPaise: checkout.totals.totalPaise,
      currency: "INR",
      status: "awaiting_method",
      idempotencyKeyHash: input.idempotencyKeyHash,
      creationToken: "creation-token",
      creationStartedAt: new Date(),
      amountRefundedPaise: 0,
      createdAt: new Date(),
    };
    return { payment: this.payment, creationToken: "creation-token" };
  }
  async attachProviderOrder(input: { providerOrder: ProviderOrder }): Promise<PaymentView> {
    const current = { ...this.payment! };
    delete current.creationToken;
    this.payment = {
      ...current,
      providerOrderId: input.providerOrder.id,
    };
    return this.payment;
  }
  async abandonProviderOrderCreation(): Promise<void> {
    return;
  }
  async findForUser(): Promise<PaymentView | null> {
    return this.payment;
  }
  async findByProviderOrder(
    _provider: PaymentProviderKind,
    providerOrderId: string,
  ): Promise<PaymentView | null> {
    return this.payment?.providerOrderId === providerOrderId ? this.payment : null;
  }
  async recordSignatureVerification(input: { providerPaymentId: string }): Promise<PaymentView> {
    if (this.payment!.status === "captured") return this.payment!;
    this.payment = {
      ...this.payment!,
      providerPaymentId: input.providerPaymentId,
      status: "pending_verification",
    };
    return this.payment;
  }
  async recordProviderPayment(input: {
    payment: ProviderPayment;
    status: "authorized" | "pending_verification";
  }): Promise<PaymentView> {
    if (this.payment!.status === "captured") return this.payment!;
    this.payment = {
      ...this.payment!,
      providerPaymentId: input.payment.id,
      status: input.status,
      providerVerifiedAt: new Date(),
    };
    return this.payment;
  }
  async markPaymentFailed(input: {
    failureCode: string;
    providerPaymentId?: string;
  }): Promise<PaymentView> {
    if (this.payment!.status === "captured") return this.payment!;
    this.payment = {
      ...this.payment!,
      status: "failed",
      failureCode: input.failureCode,
      ...(input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : {}),
    };
    return this.payment;
  }
  async registerWebhook(input: { eventId: string }): Promise<{ id: string; duplicate: boolean }> {
    const duplicate = this.events.has(input.eventId);
    this.events.add(input.eventId);
    return { id: input.eventId, duplicate };
  }
  async completeWebhook(): Promise<void> {
    return;
  }
  async findCapturedForOrder(): Promise<PaymentView | null> {
    return this.payment?.status === "captured" ? this.payment : null;
  }
  async findPendingReconciliation(): Promise<readonly PaymentView[]> {
    return this.payment && ["authorized", "pending_verification"].includes(this.payment.status)
      ? [this.payment]
      : [];
  }
  async findRefundForOrder(): Promise<RefundDto | null> {
    return this.refund;
  }
  async saveRefund(input: { refund: ProviderRefund }): Promise<RefundDto> {
    this.refund = {
      id: "507f1f77bcf86cd799439099",
      orderId,
      orderNumber: "THR-2026-000001",
      amountPaise: input.refund.amountPaise,
      currency: "INR",
      status: input.refund.status,
      providerRefundId: input.refund.id,
      createdAt: new Date().toISOString(),
    };
    return this.refund;
  }
  async applyProcessedRefund(): Promise<void> {
    return;
  }

  capture(providerPaymentId: string): void {
    this.payment = {
      ...this.payment!,
      providerPaymentId,
      status: "captured",
      providerVerifiedAt: new Date(),
      capturedAt: new Date(),
    };
  }
}

class TestProvider implements PaymentProvider {
  readonly kind = "mock" as const;
  readonly payments = new Map<string, ProviderPayment>();
  orderCounter = 0;
  refundCounter = 0;

  async createOrder(input: { amountPaise: number; currency: "INR" }): Promise<ProviderOrder> {
    this.orderCounter += 1;
    return {
      id: `order_test${this.orderCounter}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: "created",
    };
  }
  async fetchPayment(paymentIdValue: string): Promise<ProviderPayment> {
    const payment = this.payments.get(paymentIdValue);
    if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
    return payment;
  }
  async refundPayment(input: { paymentId: string; amountPaise: number }): Promise<ProviderRefund> {
    this.refundCounter += 1;
    return {
      id: `rfnd_test${this.refundCounter}`,
      paymentId: input.paymentId,
      amountPaise: input.amountPaise,
      currency: "INR",
      status: "pending",
    };
  }
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    return verifyPaymentSignature({ secret: providerSecret, ...input });
  }
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return webhookSignature(providerWebhookSecret, rawBody) === signature;
  }
}

const audits: AuditRepository = { record: async () => undefined };

function setup(provider: PaymentProvider = new TestProvider()) {
  const checkoutRepository = new MemoryCheckoutRepository();
  const paymentRepository = new MemoryPaymentRepository();
  checkoutRepository.onConfirm = (providerPaymentId) =>
    paymentRepository.capture(providerPaymentId);
  const service = new PaymentService(provider, paymentRepository, checkoutRepository, audits);
  return { checkoutRepository, paymentRepository, provider, service };
}

async function createPayment(setupResult: ReturnType<typeof setup>) {
  return setupResult.service.createPayment(userId, sessionId, "payment-idempotency", context);
}

function callback(
  providerOrderId: string,
  providerPaymentId: string,
): {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
} {
  return {
    providerOrderId,
    providerPaymentId,
    signature: paymentSignature(providerSecret, providerOrderId, providerPaymentId),
  };
}

function paymentEvent(
  event: "payment.authorized" | "payment.captured" | "payment.failed",
  payment: ProviderPayment,
): Buffer {
  return Buffer.from(
    JSON.stringify({
      event,
      payload: {
        payment: {
          entity: {
            id: payment.id,
            order_id: payment.orderId,
            amount: payment.amountPaise,
            currency: payment.currency,
            status: payment.status,
            captured: payment.captured,
            amount_refunded: payment.amountRefundedPaise,
          },
        },
      },
    }),
  );
}

describe("payment signatures", () => {
  it("accepts a valid checkout signature and rejects a changed signature", () => {
    const signature = paymentSignature(providerSecret, "order_test", "pay_test");
    expect(
      verifyPaymentSignature({
        secret: providerSecret,
        providerOrderId: "order_test",
        providerPaymentId: "pay_test",
        signature,
      }),
    ).toBe(true);
    expect(
      verifyPaymentSignature({
        secret: providerSecret,
        providerOrderId: "order_test",
        providerPaymentId: "pay_changed",
        signature,
      }),
    ).toBe(false);
  });

  it("rejects a webhook with an invalid signature before processing it", async () => {
    const environment = setup();
    const raw = Buffer.from(JSON.stringify({ event: "payment.captured", payload: {} }));
    await expect(
      environment.service.handleWebhook(raw, "0".repeat(64), "invalid-signature-event"),
    ).rejects.toMatchObject({ code: "WEBHOOK_SIGNATURE_INVALID" });
    expect(environment.paymentRepository.events.size).toBe(0);
  });
});

describe("payment lifecycle", () => {
  it("reuses the provider and internal order on a payment retry", async () => {
    const environment = setup();
    const first = await createPayment(environment);
    const second = await createPayment(environment);
    expect(second.internalOrderId).toBe(first.internalOrderId);
    expect(second.providerOrderId).toBe(first.providerOrderId);
    expect((environment.provider as TestProvider).orderCounter).toBe(1);
  });

  it("processes a duplicate webhook exactly once", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const captured: ProviderPayment = {
      id: "pay_webhook",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      amountRefundedPaise: 0,
    };
    const raw = paymentEvent("payment.captured", captured);
    const signature = webhookSignature(providerWebhookSecret, raw);
    const first = await environment.service.handleWebhook(raw, signature, "event-1");
    const repeated = await environment.service.handleWebhook(raw, signature, "event-1");
    expect(first.duplicate).toBe(false);
    expect(repeated.duplicate).toBe(true);
    expect(environment.checkoutRepository.confirmCount).toBe(1);
  });

  it("does not downgrade a captured payment when a failed webhook arrives later", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const captured: ProviderPayment = {
      id: "pay_outoforder",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      amountRefundedPaise: 0,
    };
    const capturedRaw = paymentEvent("payment.captured", captured);
    await environment.service.handleWebhook(
      capturedRaw,
      webhookSignature(providerWebhookSecret, capturedRaw),
      "event-captured",
    );
    const failedRaw = paymentEvent("payment.failed", {
      ...captured,
      status: "failed",
      captured: false,
    });
    await environment.service.handleWebhook(
      failedRaw,
      webhookSignature(providerWebhookSecret, failedRaw),
      "event-failed-late",
    );
    expect(environment.paymentRepository.payment?.status).toBe("captured");
    expect(environment.checkoutRepository.confirmCount).toBe(1);
    expect(environment.checkoutRepository.releaseCount).toBe(0);
  });

  it("rejects an amount mismatch and releases the reservation", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const provider = environment.provider as TestProvider;
    provider.payments.set("pay_mismatch", {
      id: "pay_mismatch",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise + 1,
      currency: "INR",
      status: "captured",
      captured: true,
      amountRefundedPaise: 0,
    });
    await expect(
      environment.service.verifyClientCallback(
        userId,
        sessionId,
        callback(checkoutParameters.providerOrderId, "pay_mismatch"),
        context,
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(environment.checkoutRepository.releaseCount).toBe(1);
    expect(environment.paymentRepository.payment?.status).toBe("failed");
  });

  it("keeps an already confirmed order idempotent on a repeated callback", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const provider = environment.provider as TestProvider;
    provider.payments.set("pay_confirmed", {
      id: "pay_confirmed",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      amountRefundedPaise: 0,
    });
    const signed = callback(checkoutParameters.providerOrderId, "pay_confirmed");
    await environment.service.verifyClientCallback(userId, sessionId, signed, context);
    await environment.service.verifyClientCallback(userId, sessionId, signed, context);
    expect(environment.checkoutRepository.confirmCount).toBe(1);
  });

  it("releases reserved stock after a definitive payment failure", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const provider = environment.provider as TestProvider;
    provider.payments.set("pay_failed", {
      id: "pay_failed",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise,
      currency: "INR",
      status: "failed",
      captured: false,
      amountRefundedPaise: 0,
    });
    const status = await environment.service.verifyClientCallback(
      userId,
      sessionId,
      callback(checkoutParameters.providerOrderId, "pay_failed"),
      context,
    );
    expect(status.status).toBe("failed");
    expect(environment.checkoutRepository.releaseCount).toBe(1);
  });

  it("completes a local mock payment end to end", async () => {
    const environment = setup(new MockPaymentProvider());
    await createPayment(environment);
    const status = await environment.service.completeMockPayment(userId, sessionId, context);
    expect(status.status).toBe("captured");
    expect(environment.checkoutRepository.confirmCount).toBe(1);
  });

  it("returns the existing refund without calling the provider twice", async () => {
    const environment = setup();
    const checkoutParameters = await createPayment(environment);
    const provider = environment.provider as TestProvider;
    provider.payments.set("pay_refund", {
      id: "pay_refund",
      orderId: checkoutParameters.providerOrderId,
      amountPaise: checkoutParameters.amountPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      amountRefundedPaise: 0,
    });
    await environment.service.verifyClientCallback(
      userId,
      sessionId,
      callback(checkoutParameters.providerOrderId, "pay_refund"),
      context,
    );
    const first = await environment.service.refundOrder(
      userId,
      orderId,
      { reason: "Customer requested cancellation." },
      context,
    );
    const repeated = await environment.service.refundOrder(
      userId,
      orderId,
      { reason: "Customer requested cancellation." },
      context,
    );
    expect(repeated.id).toBe(first.id);
    expect(provider.refundCounter).toBe(1);
  });
});

describe("payment environment", () => {
  it("requires Razorpay live credentials in production", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        PAYMENT_PROVIDER: "razorpay",
        RAZORPAY_MODE: "live",
      }),
    ).toThrow(/RAZORPAY_LIVE_KEY_ID/);
  });
});
