import { createHash } from "node:crypto";

import type { OrderDto, PaymentCheckoutDto, PaymentStatusDto, RefundDto } from "@thread/types";
import type { AdminRefundInput, PaymentCallbackInput } from "@thread/validation";

import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { CheckoutRepository } from "../checkout/checkout.types.js";
import { hashIdempotencyKey } from "../checkout/repositories/mongoose-checkout.repository.js";
import { HttpError } from "../middleware/error-handler.js";
import type { PaymentRepository, PaymentView } from "./payment.types.js";
import { MockPaymentProvider } from "./providers/mock-payment.provider.js";
import type {
  PaymentProvider,
  ProviderPayment,
  SafeProviderError,
} from "./providers/payment.provider.js";
import type { NotificationService } from "../notifications/notification.service.js";

function validateIdempotencyKey(value: string): void {
  if (!/^[A-Za-z0-9._-]{8,128}$/.test(value))
    throw new HttpError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "A valid Idempotency-Key header is required.",
    );
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function entity(payload: Record<string, unknown>, name: string): Record<string, unknown> | null {
  const wrapper = object(payload[name]);
  return wrapper ? object(wrapper.entity) : null;
}

function providerPaymentFromWebhook(value: Record<string, unknown>): ProviderPayment | null {
  if (
    typeof value.id !== "string" ||
    typeof value.order_id !== "string" ||
    !Number.isInteger(value.amount) ||
    value.currency !== "INR" ||
    typeof value.status !== "string" ||
    !["created", "authorized", "captured", "failed", "refunded"].includes(value.status)
  )
    return null;
  return {
    id: value.id,
    orderId: value.order_id,
    amountPaise: value.amount as number,
    currency: "INR",
    status: value.status as ProviderPayment["status"],
    captured: value.captured === true || value.status === "captured",
    ...(typeof value.method === "string" ? { method: value.method } : {}),
    amountRefundedPaise:
      Number.isInteger(value.amount_refunded) && (value.amount_refunded as number) >= 0
        ? (value.amount_refunded as number)
        : 0,
  };
}

function providerErrorCode(error: unknown): string {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as SafeProviderError).code === "string"
  )
    return (error as SafeProviderError).code;
  return "PAYMENT_PROVIDER_ERROR";
}

export class PaymentService {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly repository: PaymentRepository,
    private readonly checkoutRepository: CheckoutRepository,
    private readonly audits: AuditRepository,
    private readonly notifications?: Pick<NotificationService, "orderCreated" | "paymentUpdated">,
  ) {}

  async createPayment(
    userId: string,
    checkoutSessionId: string,
    idempotencyKey: string,
    context: AuthContext,
  ): Promise<PaymentCheckoutDto> {
    validateIdempotencyKey(idempotencyKey);
    const checkout = await this.checkoutRepository.validateSessionPayable(
      userId,
      checkoutSessionId,
    );
    const order = await this.checkoutRepository.preparePendingOrder(userId, checkoutSessionId);
    if (order.status !== "pending_payment")
      throw new HttpError(409, "ORDER_ALREADY_CONFIRMED", "Order is already confirmed.");
    const preparation = await this.repository.acquireProviderOrderCreation({
      order,
      checkoutSessionId,
      userId,
      provider: this.provider.kind,
      idempotencyKeyHash: hashIdempotencyKey(idempotencyKey),
    });
    let payment = preparation.payment;
    if (!payment.providerOrderId) {
      if (!preparation.creationToken)
        throw new HttpError(409, "PAYMENT_CREATION_IN_PROGRESS", "Payment is being prepared.");
      try {
        const providerOrder = await this.provider.createOrder({
          amountPaise: order.totals.totalPaise,
          currency: "INR",
          receipt: order.orderNumber,
          notes: {
            internal_order_id: order.id,
            checkout_session_id: checkoutSessionId,
          },
        });
        if (
          providerOrder.amountPaise !== order.totals.totalPaise ||
          providerOrder.currency !== "INR"
        )
          throw new HttpError(
            502,
            "PAYMENT_AMOUNT_MISMATCH",
            "Payment provider returned an unexpected amount.",
          );
        payment = await this.repository.attachProviderOrder({
          paymentId: payment.id,
          creationToken: preparation.creationToken,
          providerOrder,
        });
      } catch (error) {
        await this.repository.abandonProviderOrderCreation(payment.id, preparation.creationToken);
        throw error;
      }
    }
    const identity = await this.repository.getCheckoutIdentity(userId);
    await this.audit("payment.order_created", userId, order.id, context, {
      provider: this.provider.kind,
      amountPaise: order.totals.totalPaise,
    });
    return this.checkoutParameters(checkout, order, payment, identity);
  }

  async verifyClientCallback(
    userId: string,
    checkoutSessionId: string,
    callback: PaymentCallbackInput,
    context: AuthContext,
  ): Promise<PaymentStatusDto> {
    const payment = await this.requiredPayment(userId, checkoutSessionId);
    if (!payment.providerOrderId || callback.providerOrderId !== payment.providerOrderId)
      throw new HttpError(400, "PAYMENT_ORDER_MISMATCH", "Payment order did not match.");
    if (
      !this.provider.verifyCheckoutSignature({
        providerOrderId: payment.providerOrderId,
        providerPaymentId: callback.providerPaymentId,
        signature: callback.signature,
      })
    )
      throw new HttpError(400, "PAYMENT_SIGNATURE_INVALID", "Payment signature was invalid.");
    const signed = await this.repository.recordSignatureVerification({
      paymentId: payment.id,
      providerPaymentId: callback.providerPaymentId,
    });
    await this.audit("payment.callback_verified", userId, payment.orderId, context, {
      provider: this.provider.kind,
    });
    const providerPayment = await this.provider.fetchPayment(callback.providerPaymentId);
    await this.applyProviderPayment(signed, providerPayment, `callback-${signed.id}`);
    return this.getStatus(userId, checkoutSessionId, false);
  }

  async getStatus(
    userId: string,
    checkoutSessionId: string,
    reconcile = true,
  ): Promise<PaymentStatusDto> {
    let payment = await this.requiredPayment(userId, checkoutSessionId);
    const shouldReconcile =
      reconcile &&
      payment.providerPaymentId &&
      !["captured", "failed", "refunded"].includes(payment.status) &&
      (!payment.providerVerifiedAt || Date.now() - payment.providerVerifiedAt.getTime() >= 5_000);
    if (shouldReconcile) {
      const providerPayment = await this.provider.fetchPayment(payment.providerPaymentId!);
      await this.applyProviderPayment(payment, providerPayment, `poll-${payment.id}`);
      payment = await this.requiredPayment(userId, checkoutSessionId);
    }
    const order = await this.checkoutRepository.findOrderById(payment.orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    return this.statusDto(payment, order);
  }

  async completeMockPayment(
    userId: string,
    checkoutSessionId: string,
    context: AuthContext,
  ): Promise<PaymentStatusDto> {
    if (!(this.provider instanceof MockPaymentProvider))
      throw new HttpError(404, "ROUTE_NOT_FOUND", "Mock payments are unavailable.");
    const payment = await this.requiredPayment(userId, checkoutSessionId);
    if (!payment.providerOrderId)
      throw new HttpError(409, "PAYMENT_NOT_READY", "Payment is not ready.");
    const callback = this.provider.completePayment(payment.providerOrderId);
    return this.verifyClientCallback(userId, checkoutSessionId, callback, context);
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string,
    suppliedEventId: string | undefined,
  ): Promise<{ duplicate: boolean }> {
    if (!this.provider.verifyWebhookSignature(rawBody, signature))
      throw new HttpError(400, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature was invalid.");
    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as unknown;
    } catch {
      throw new HttpError(400, "WEBHOOK_INVALID", "Webhook payload was invalid.");
    }
    const root = object(body);
    const payload = root ? object(root.payload) : null;
    const eventType = root?.event;
    if (!payload || typeof eventType !== "string")
      throw new HttpError(400, "WEBHOOK_INVALID", "Webhook payload was invalid.");
    const paymentEntity = entity(payload, "payment");
    const refundEntity = entity(payload, "refund");
    const providerOrderId =
      typeof paymentEntity?.order_id === "string"
        ? paymentEntity.order_id
        : typeof entity(payload, "order")?.id === "string"
          ? (entity(payload, "order")!.id as string)
          : undefined;
    const providerPaymentId =
      typeof paymentEntity?.id === "string"
        ? paymentEntity.id
        : typeof refundEntity?.payment_id === "string"
          ? refundEntity.payment_id
          : undefined;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const eventId = suppliedEventId?.trim() || `hash-${payloadHash}`;
    const event = await this.repository.registerWebhook({
      provider: this.provider.kind,
      eventId,
      payloadHash,
      eventType,
      ...(providerOrderId ? { providerOrderId } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
    });
    if (event.duplicate) return { duplicate: true };
    try {
      let relatedOrderId: string | undefined;
      if (
        ["payment.authorized", "payment.captured", "payment.failed", "order.paid"].includes(
          eventType,
        )
      ) {
        const parsedPayment = paymentEntity ? providerPaymentFromWebhook(paymentEntity) : null;
        if (!parsedPayment)
          throw new HttpError(400, "WEBHOOK_INVALID", "Payment webhook was invalid.");
        const payment = await this.repository.findByProviderOrder(
          this.provider.kind,
          parsedPayment.orderId,
        );
        if (!payment) {
          await this.repository.completeWebhook(event.id, "ignored");
          return { duplicate: false };
        }
        relatedOrderId = payment.orderId;
        if (eventType === "payment.authorized") {
          await this.repository.recordProviderPayment({
            paymentId: payment.id,
            payment: parsedPayment,
            status: "authorized",
          });
        } else if (eventType === "payment.failed") {
          await this.failPayment(payment, "provider_reported_failure", parsedPayment.id);
        } else {
          await this.applyProviderPayment(
            payment,
            { ...parsedPayment, status: "captured", captured: true },
            `webhook-${eventId}`,
          );
        }
      } else if (eventType === "refund.processed") {
        if (typeof refundEntity?.id !== "string" || typeof refundEntity.payment_id !== "string")
          throw new HttpError(400, "WEBHOOK_INVALID", "Refund webhook was invalid.");
        await this.repository.applyProcessedRefund(refundEntity.id, refundEntity.payment_id);
      } else {
        await this.repository.completeWebhook(event.id, "ignored");
        return { duplicate: false };
      }
      await this.repository.completeWebhook(event.id, "processed", {
        ...(relatedOrderId ? { relatedOrderId } : {}),
      });
      return { duplicate: false };
    } catch (error) {
      await this.repository.completeWebhook(event.id, "failed", {
        failureCode: providerErrorCode(error),
      });
      throw error;
    }
  }

  async refundOrder(
    actorId: string,
    orderId: string,
    input: AdminRefundInput,
    context: AuthContext,
  ): Promise<RefundDto> {
    const order = await this.checkoutRepository.findOrderById(orderId);
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
    const existingRefund = await this.repository.findRefundForOrder(orderId);
    if (existingRefund) return existingRefund;
    const payment = await this.repository.findCapturedForOrder(orderId);
    if (!payment?.providerPaymentId)
      throw new HttpError(409, "PAYMENT_NOT_REFUNDABLE", "No captured payment is refundable.");
    if (payment.provider !== this.provider.kind)
      throw new HttpError(409, "PAYMENT_PROVIDER_MISMATCH", "Payment provider is unavailable.");
    const amountPaise = payment.amountPaise - payment.amountRefundedPaise;
    if (amountPaise <= 0)
      throw new HttpError(409, "PAYMENT_ALREADY_REFUNDED", "Payment is already refunded.");
    const receipt = `${order.orderNumber}-refund`.slice(0, 40);
    const refund = await this.provider.refundPayment({
      paymentId: payment.providerPaymentId,
      amountPaise,
      receipt,
      notes: { internal_order_id: order.id, reason: input.reason.slice(0, 200) },
    });
    if (
      refund.paymentId !== payment.providerPaymentId ||
      refund.amountPaise !== amountPaise ||
      refund.currency !== "INR"
    )
      throw new HttpError(502, "REFUND_MISMATCH", "Refund response did not match the order.");
    const saved = await this.repository.saveRefund({
      order,
      payment,
      actorId,
      reason: input.reason,
      receipt,
      refund,
    });
    await this.audit("payment.refund_requested", actorId, order.id, context, {
      amountPaise,
      provider: this.provider.kind,
    });
    return saved;
  }

  async reconcilePending(limit = 100): Promise<{ checked: number; failed: number }> {
    const pending = await this.repository.findPendingReconciliation(
      limit,
      new Date(Date.now() - 60_000),
    );
    let failed = 0;
    for (const payment of pending) {
      if (!payment.providerPaymentId || payment.provider !== this.provider.kind) continue;
      try {
        const providerPayment = await this.provider.fetchPayment(payment.providerPaymentId);
        await this.applyProviderPayment(payment, providerPayment, `reconciliation-${payment.id}`);
      } catch {
        failed += 1;
      }
    }
    return { checked: pending.length, failed };
  }

  private async applyProviderPayment(
    payment: PaymentView,
    providerPayment: ProviderPayment,
    idempotencyKey: string,
  ): Promise<void> {
    if (
      !payment.providerOrderId ||
      providerPayment.orderId !== payment.providerOrderId ||
      providerPayment.amountPaise !== payment.amountPaise ||
      providerPayment.currency !== payment.currency
    ) {
      await this.failPayment(payment, "payment_amount_or_order_mismatch", providerPayment.id);
      throw new HttpError(
        409,
        "PAYMENT_AMOUNT_MISMATCH",
        "Verified payment did not match the internal order.",
      );
    }
    if (providerPayment.status === "failed") {
      await this.failPayment(payment, "provider_reported_failure", providerPayment.id);
      return;
    }
    if (providerPayment.status === "captured" && providerPayment.captured) {
      const order = await this.checkoutRepository.confirmSession({
        sessionId: payment.checkoutSessionId,
        confirmationIdempotencyKeyHash: hashIdempotencyKey(idempotencyKey),
        provider: this.provider.kind,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: providerPayment.id,
      });
      await this.notifications?.orderCreated(order, payment.userId);
      this.notifications?.paymentUpdated(payment.orderId, payment.userId, "captured");
      return;
    }
    await this.repository.recordProviderPayment({
      paymentId: payment.id,
      payment: providerPayment,
      status: providerPayment.status === "authorized" ? "authorized" : "pending_verification",
    });
    this.notifications?.paymentUpdated(
      payment.orderId,
      payment.userId,
      providerPayment.status === "authorized" ? "authorized" : "pending_verification",
    );
  }

  private async failPayment(
    payment: PaymentView,
    failureCode: string,
    providerPaymentId?: string,
  ): Promise<void> {
    const failed = await this.repository.markPaymentFailed({
      paymentId: payment.id,
      failureCode,
      ...(providerPaymentId ? { providerPaymentId } : {}),
    });
    if (failed.status === "failed")
      await this.checkoutRepository.releaseSession(payment.checkoutSessionId, "payment_failed");
    if (failed.status === "failed")
      this.notifications?.paymentUpdated(payment.orderId, payment.userId, "failed");
  }

  private async requiredPayment(userId: string, checkoutSessionId: string): Promise<PaymentView> {
    const payment = await this.repository.findForUser(checkoutSessionId, userId);
    if (!payment) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    if (payment.provider !== this.provider.kind)
      throw new HttpError(409, "PAYMENT_PROVIDER_MISMATCH", "Payment provider is unavailable.");
    return payment;
  }

  private checkoutParameters(
    checkout: Awaited<ReturnType<CheckoutRepository["validateSessionPayable"]>>,
    order: OrderDto,
    payment: PaymentView,
    identity: Awaited<ReturnType<PaymentRepository["getCheckoutIdentity"]>>,
  ): PaymentCheckoutDto {
    if (!payment.providerOrderId)
      throw new HttpError(500, "PAYMENT_NOT_READY", "Payment is not ready.");
    return {
      provider: this.provider.kind,
      ...(this.provider.publicKeyId ? { keyId: this.provider.publicKeyId } : {}),
      providerOrderId: payment.providerOrderId,
      internalOrderId: order.id,
      orderNumber: order.orderNumber,
      amountPaise: payment.amountPaise,
      currency: "INR",
      brandName: identity.brandName,
      description: `Payment for ${order.orderNumber}`,
      customer: {
        name: identity.name,
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.phone ? { phone: identity.phone } : {}),
      },
      expiresAt: checkout.expiresAt,
    };
  }

  private statusDto(payment: PaymentView, order: OrderDto): PaymentStatusDto {
    const terminal = ["captured", "failed", "refunded"].includes(payment.status);
    return {
      checkoutSessionId: payment.checkoutSessionId,
      paymentId: payment.id,
      status: payment.status,
      message:
        payment.status === "captured"
          ? "Payment verified and order confirmed."
          : payment.status === "failed"
            ? "Payment failed. Reserved stock has been released."
            : payment.status === "refunded"
              ? "Payment was refunded."
              : "Payment verification is in progress.",
      retryable: !terminal,
      ...(payment.status === "captured" || payment.status === "refunded"
        ? {
            receipt: {
              internalOrderId: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              amountPaise: payment.amountPaise,
              currency: "INR" as const,
              provider: this.provider.kind,
              ...(payment.providerPaymentId
                ? { providerPaymentId: payment.providerPaymentId }
                : {}),
              ...(payment.capturedAt ? { capturedAt: payment.capturedAt.toISOString() } : {}),
              createdAt: payment.createdAt.toISOString(),
            },
          }
        : {}),
    };
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
      entity: "payment",
      entityId,
      ...(metadata ? { metadata } : {}),
    });
  }
}
