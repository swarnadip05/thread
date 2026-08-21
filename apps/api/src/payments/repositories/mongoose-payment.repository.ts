import { randomBytes } from "node:crypto";

import mongoose from "mongoose";
import type { Types } from "mongoose";
import type { OrderDto, PaymentProviderKind, RefundDto } from "@thread/types";

import { OrderModel } from "../../checkout/models/order.model.js";
import { PaymentRecordModel, type PaymentRecord } from "../../checkout/models/payment.model.js";
import { HttpError } from "../../middleware/error-handler.js";
import { SiteSettingsModel } from "../../models/site-settings.model.js";
import { UserModel } from "../../models/user.model.js";
import { PaymentWebhookEventModel } from "../models/payment-webhook-event.model.js";
import { RefundRecordModel } from "../models/refund.model.js";
import type { PaymentOrderPreparation, PaymentRepository, PaymentView } from "../payment.types.js";
import type {
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
} from "../providers/payment.provider.js";

type PaymentWithId = PaymentRecord & { _id: Types.ObjectId };

function paymentView(payment: PaymentWithId): PaymentView {
  return {
    id: payment._id.toString(),
    checkoutSessionId: payment.checkoutSessionId.toString(),
    orderId: payment.orderId.toString(),
    userId: payment.userId.toString(),
    provider: payment.provider,
    ...(payment.providerOrderId ? { providerOrderId: payment.providerOrderId } : {}),
    ...(payment.providerPaymentId ? { providerPaymentId: payment.providerPaymentId } : {}),
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    status: payment.status,
    idempotencyKeyHash: payment.idempotencyKeyHash,
    ...(payment.creationToken ? { creationToken: payment.creationToken } : {}),
    ...(payment.creationStartedAt ? { creationStartedAt: payment.creationStartedAt } : {}),
    ...(payment.providerVerifiedAt ? { providerVerifiedAt: payment.providerVerifiedAt } : {}),
    ...(payment.capturedAt ? { capturedAt: payment.capturedAt } : {}),
    ...(payment.method ? { method: payment.method } : {}),
    amountRefundedPaise: payment.amountRefundedPaise,
    ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
    createdAt: payment.createdAt,
  };
}

export class MongoosePaymentRepository implements PaymentRepository {
  async getCheckoutIdentity(userId: string): Promise<{
    brandName: string;
    name: string;
    email?: string;
    phone?: string;
  }> {
    const [user, settings] = await Promise.all([
      UserModel.findById(userId).select({ name: 1, email: 1, phone: 1 }).lean(),
      SiteSettingsModel.findOne({ key: "default" }).select({ "business.brandName": 1 }).lean(),
    ]);
    if (!user) throw new HttpError(401, "UNAUTHORIZED", "Authentication is required.");
    return {
      brandName: settings?.business.brandName || "THREAD",
      name: user.name,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
    };
  }

  async acquireProviderOrderCreation(input: {
    order: OrderDto;
    checkoutSessionId: string;
    userId: string;
    provider: PaymentProviderKind;
    idempotencyKeyHash: string;
  }): Promise<PaymentOrderPreparation> {
    const existing = await PaymentRecordModel.findOne({
      checkoutSessionId: input.checkoutSessionId,
      userId: input.userId,
    })
      .select("+idempotencyKeyHash +creationToken")
      .lean();
    if (existing?.providerOrderId) return { payment: paymentView(existing) };
    const creationToken = randomBytes(24).toString("hex");
    if (!existing) {
      try {
        const created = await PaymentRecordModel.create({
          orderId: input.order.id,
          checkoutSessionId: input.checkoutSessionId,
          userId: input.userId,
          provider: input.provider,
          amountPaise: input.order.totals.totalPaise,
          currency: "INR",
          status: "awaiting_method",
          idempotencyKeyHash: input.idempotencyKeyHash,
          creationToken,
          creationStartedAt: new Date(),
          amountRefundedPaise: 0,
        });
        return {
          payment: paymentView(
            await PaymentRecordModel.findById(created._id)
              .select("+idempotencyKeyHash +creationToken")
              .lean()
              .orFail(),
          ),
          creationToken,
        };
      } catch (error) {
        if (!(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11_000
        ))
          throw error;
      }
    }
    const leaseCutoff = new Date(Date.now() - 30_000);
    const leased = await PaymentRecordModel.findOneAndUpdate(
      {
        checkoutSessionId: input.checkoutSessionId,
        userId: input.userId,
        providerOrderId: { $exists: false },
        $or: [{ creationToken: { $exists: false } }, { creationStartedAt: { $lte: leaseCutoff } }],
      },
      {
        $set: {
          creationToken,
          creationStartedAt: new Date(),
          status: "awaiting_method",
          failureCode: null,
        },
      },
      { new: true },
    )
      .select("+idempotencyKeyHash +creationToken")
      .lean();
    if (leased) return { payment: paymentView(leased), creationToken };
    const current = await PaymentRecordModel.findOne({
      checkoutSessionId: input.checkoutSessionId,
      userId: input.userId,
    })
      .select("+idempotencyKeyHash +creationToken")
      .lean();
    if (current?.providerOrderId) return { payment: paymentView(current) };
    throw new HttpError(
      409,
      "PAYMENT_CREATION_IN_PROGRESS",
      "Payment preparation is already in progress. Please retry shortly.",
    );
  }

  async attachProviderOrder(input: {
    paymentId: string;
    creationToken: string;
    providerOrder: ProviderOrder;
  }): Promise<PaymentView> {
    const updated = await PaymentRecordModel.findOneAndUpdate(
      {
        _id: input.paymentId,
        creationToken: input.creationToken,
        providerOrderId: { $exists: false },
        amountPaise: input.providerOrder.amountPaise,
        currency: input.providerOrder.currency,
      },
      {
        $set: {
          providerOrderId: input.providerOrder.id,
          status: "awaiting_method",
          failureCode: null,
        },
        $unset: { creationToken: 1, creationStartedAt: 1 },
      },
      { new: true },
    )
      .select("+idempotencyKeyHash")
      .lean();
    if (!updated)
      throw new HttpError(
        409,
        "PAYMENT_ORDER_MISMATCH",
        "Provider payment order did not match the internal order.",
      );
    return paymentView(updated);
  }

  async abandonProviderOrderCreation(paymentId: string, creationToken: string): Promise<void> {
    await PaymentRecordModel.updateOne(
      { _id: paymentId, creationToken },
      {
        $set: { failureCode: "provider_order_creation_failed" },
        $unset: { creationToken: 1, creationStartedAt: 1 },
      },
    );
  }

  async findForUser(checkoutSessionId: string, userId: string): Promise<PaymentView | null> {
    const payment = await PaymentRecordModel.findOne({ checkoutSessionId, userId })
      .select("+idempotencyKeyHash")
      .lean();
    return payment ? paymentView(payment) : null;
  }
  async findPendingReconciliation(
    limit: number,
    staleBefore: Date,
  ): Promise<readonly PaymentView[]> {
    const payments = await PaymentRecordModel.find({
      status: { $in: ["authorized", "pending_verification"] },
      providerPaymentId: { $type: "string" },
      updatedAt: { $lte: staleBefore },
    })
      .select("+idempotencyKeyHash")
      .sort({ updatedAt: 1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .lean();
    return payments.map(paymentView);
  }

  async findByProviderOrder(
    provider: PaymentProviderKind,
    providerOrderId: string,
  ): Promise<PaymentView | null> {
    const payment = await PaymentRecordModel.findOne({ provider, providerOrderId })
      .select("+idempotencyKeyHash")
      .lean();
    return payment ? paymentView(payment) : null;
  }

  async recordSignatureVerification(input: {
    paymentId: string;
    providerPaymentId: string;
  }): Promise<PaymentView> {
    const payment = await PaymentRecordModel.findOneAndUpdate(
      {
        _id: input.paymentId,
        status: { $nin: ["captured", "refunded"] },
      },
      {
        $set: {
          providerPaymentId: input.providerPaymentId,
          signatureVerifiedAt: new Date(),
          status: "pending_verification",
          failureCode: null,
        },
      },
      { new: true },
    )
      .select("+idempotencyKeyHash")
      .lean();
    if (payment) return paymentView(payment);
    const terminal = await PaymentRecordModel.findById(input.paymentId)
      .select("+idempotencyKeyHash")
      .lean();
    if (!terminal) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    return paymentView(terminal);
  }

  async recordProviderPayment(input: {
    paymentId: string;
    payment: ProviderPayment;
    status: "authorized" | "pending_verification";
  }): Promise<PaymentView> {
    const payment = await PaymentRecordModel.findOneAndUpdate(
      {
        _id: input.paymentId,
        status: { $nin: ["captured", "refunded"] },
      },
      {
        $set: {
          providerPaymentId: input.payment.id,
          status: input.status,
          providerVerifiedAt: new Date(),
          method: input.payment.method,
          amountRefundedPaise: input.payment.amountRefundedPaise,
          failureCode: null,
        },
      },
      { new: true },
    )
      .select("+idempotencyKeyHash")
      .lean();
    if (payment) return paymentView(payment);
    const terminal = await PaymentRecordModel.findById(input.paymentId)
      .select("+idempotencyKeyHash")
      .lean();
    if (!terminal) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
    return paymentView(terminal);
  }

  async markPaymentFailed(input: {
    paymentId: string;
    failureCode: string;
    providerPaymentId?: string;
  }): Promise<PaymentView> {
    const session = await mongoose.startSession();
    try {
      let output: PaymentView | null = null;
      await session.withTransaction(async () => {
        const payment = await PaymentRecordModel.findOneAndUpdate(
          {
            _id: input.paymentId,
            status: { $nin: ["captured", "refunded"] },
          },
          {
            $set: {
              status: "failed",
              failureCode: input.failureCode,
              ...(input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : {}),
              providerVerifiedAt: new Date(),
            },
          },
          { new: true, session },
        )
          .select("+idempotencyKeyHash")
          .lean();
        if (!payment) {
          const terminal = await PaymentRecordModel.findById(input.paymentId)
            .session(session)
            .select("+idempotencyKeyHash")
            .lean();
          if (!terminal) throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
          output = paymentView(terminal);
          return;
        }
        await OrderModel.updateOne(
          { _id: payment.orderId, status: "pending_payment" },
          {
            $set: { status: "payment_failed" },
            $push: { statusHistory: { status: "payment_failed", at: new Date() } },
          },
          { session },
        );
        output = paymentView(payment);
      });
      return output!;
    } finally {
      await session.endSession();
    }
  }

  async registerWebhook(input: {
    provider: PaymentProviderKind;
    eventId: string;
    payloadHash: string;
    eventType: string;
    providerOrderId?: string;
    providerPaymentId?: string;
  }): Promise<{ id: string; duplicate: boolean }> {
    try {
      const event = await PaymentWebhookEventModel.create({ ...input, status: "processing" });
      return { id: event.id, duplicate: false };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) {
        const retry = await PaymentWebhookEventModel.findOneAndUpdate(
          {
            provider: input.provider,
            eventId: input.eventId,
            payloadHash: input.payloadHash,
            status: "failed",
          },
          {
            $set: { status: "processing" },
            $unset: { failureCode: 1, processedAt: 1, relatedOrderId: 1 },
          },
          { new: true },
        ).lean();
        if (retry) return { id: retry._id.toString(), duplicate: false };
        const existing = await PaymentWebhookEventModel.findOne({
          provider: input.provider,
          $or: [{ eventId: input.eventId }, { payloadHash: input.payloadHash }],
        }).lean();
        if (existing) return { id: existing._id.toString(), duplicate: true };
      }
      throw error;
    }
  }

  async completeWebhook(
    id: string,
    status: "processed" | "ignored" | "failed",
    input: { failureCode?: string; relatedOrderId?: string } = {},
  ): Promise<void> {
    await PaymentWebhookEventModel.updateOne(
      { _id: id },
      {
        $set: {
          status,
          processedAt: new Date(),
          ...(input.failureCode ? { failureCode: input.failureCode } : {}),
          ...(input.relatedOrderId ? { relatedOrderId: input.relatedOrderId } : {}),
        },
      },
    );
  }

  async findCapturedForOrder(orderId: string): Promise<PaymentView | null> {
    const payment = await PaymentRecordModel.findOne({
      orderId,
      status: "captured",
      provider: { $in: ["razorpay", "mock"] },
    })
      .select("+idempotencyKeyHash")
      .lean();
    return payment ? paymentView(payment) : null;
  }

  async saveRefund(input: {
    order: OrderDto;
    payment: PaymentView;
    actorId: string;
    reason: string;
    receipt: string;
    refund: ProviderRefund;
  }): Promise<RefundDto> {
    if (input.payment.provider === "cod")
      throw new HttpError(409, "PAYMENT_NOT_REFUNDABLE", "COD payment is not refundable online.");
    const refundProvider: PaymentProviderKind = input.payment.provider;
    const session = await mongoose.startSession();
    try {
      let output: RefundDto | null = null;
      await session.withTransaction(async () => {
        const existing = await RefundRecordModel.findOne({ orderId: input.order.id })
          .session(session)
          .lean();
        if (existing) {
          output = {
            id: existing._id.toString(),
            orderId: existing.orderId.toString(),
            orderNumber: input.order.orderNumber,
            amountPaise: existing.amountPaise,
            currency: existing.currency,
            status: existing.status,
            providerRefundId: existing.providerRefundId,
            createdAt: existing.createdAt.toISOString(),
          };
          return;
        }
        const records = await RefundRecordModel.create(
          [
            {
              orderId: input.order.id,
              paymentId: input.payment.id,
              actorId: input.actorId,
              provider: refundProvider,
              providerPaymentId: input.refund.paymentId,
              providerRefundId: input.refund.id,
              amountPaise: input.refund.amountPaise,
              currency: input.refund.currency,
              reason: input.reason,
              receipt: input.receipt,
              status: input.refund.status,
              ...(input.refund.status === "processed" ? { processedAt: new Date() } : {}),
            },
          ],
          { session },
        );
        if (input.refund.status === "processed")
          await this.markRefundProcessedWithinSession(
            input.payment.id,
            input.order.id,
            input.refund.amountPaise,
            session,
          );
        const refund = records[0]!;
        output = {
          id: refund.id,
          orderId: input.order.id,
          orderNumber: input.order.orderNumber,
          amountPaise: refund.amountPaise,
          currency: refund.currency,
          status: refund.status,
          providerRefundId: refund.providerRefundId,
          createdAt: refund.createdAt.toISOString(),
        };
      });
      return output!;
    } finally {
      await session.endSession();
    }
  }

  async applyProcessedRefund(providerRefundId: string, providerPaymentId: string): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const refund = await RefundRecordModel.findOneAndUpdate(
          { providerRefundId, providerPaymentId, status: { $ne: "processed" } },
          { $set: { status: "processed", processedAt: new Date() } },
          { new: true, session },
        ).lean();
        if (!refund) return;
        await this.markRefundProcessedWithinSession(
          refund.paymentId.toString(),
          refund.orderId.toString(),
          refund.amountPaise,
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async findRefundForOrder(orderId: string): Promise<RefundDto | null> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
    const refund = await RefundRecordModel.findOne({ orderId }).lean();
    if (!refund) return null;
    const order = await OrderModel.findById(orderId).select({ orderNumber: 1 }).lean();
    if (!order) return null;
    return {
      id: refund._id.toString(),
      orderId,
      orderNumber: order.orderNumber,
      amountPaise: refund.amountPaise,
      currency: refund.currency,
      status: refund.status,
      providerRefundId: refund.providerRefundId,
      createdAt: refund.createdAt.toISOString(),
    };
  }

  private async markRefundProcessedWithinSession(
    paymentId: string,
    orderId: string,
    amountPaise: number,
    session: mongoose.ClientSession,
  ): Promise<void> {
    const payment = await PaymentRecordModel.findOneAndUpdate(
      { _id: paymentId, status: { $in: ["captured", "refunded"] } },
      {
        $set: { status: "refunded" },
        $inc: { amountRefundedPaise: amountPaise },
      },
      { new: true, session },
    ).lean();
    if (payment && payment.amountRefundedPaise >= payment.amountPaise)
      await OrderModel.updateOne(
        { _id: orderId, status: { $nin: ["refunded"] } },
        {
          $set: { status: "refunded" },
          $push: { statusHistory: { status: "refunded", at: new Date() } },
        },
        { session },
      );
  }
}
