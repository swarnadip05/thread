import { randomBytes } from "node:crypto";

import type {
  PaymentProvider,
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
} from "./payment.provider.js";
import { SafeProviderError } from "./payment.provider.js";
import {
  paymentSignature,
  verifyPaymentSignature,
  verifyRawWebhookSignature,
} from "./signatures.js";

const mockSecret = "thread-local-mock-payment-secret-not-for-production";
const mockWebhookSecret = "thread-local-mock-webhook-secret-not-for-production";

export class MockPaymentProvider implements PaymentProvider {
  readonly kind = "mock" as const;
  private readonly orders = new Map<string, ProviderOrder>();
  private readonly ordersByReceipt = new Map<string, string>();
  private readonly payments = new Map<string, ProviderPayment>();

  async createOrder(input: {
    amountPaise: number;
    currency: "INR";
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderOrder> {
    await Promise.resolve();
    const existingId = this.ordersByReceipt.get(input.receipt);
    if (existingId) return this.orders.get(existingId)!;
    const order: ProviderOrder = {
      id: `order_mock${randomBytes(8).toString("hex")}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      status: "created",
    };
    this.orders.set(order.id, order);
    this.ordersByReceipt.set(input.receipt, order.id);
    return order;
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    await Promise.resolve();
    const payment = this.payments.get(paymentId);
    if (!payment) throw new SafeProviderError("PAYMENT_NOT_FOUND", 404);
    return payment;
  }

  async refundPayment(input: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderRefund> {
    const payment = await this.fetchPayment(input.paymentId);
    if (payment.status !== "captured") throw new SafeProviderError("PAYMENT_NOT_CAPTURED", 409);
    this.payments.set(input.paymentId, {
      ...payment,
      status: "refunded",
      amountRefundedPaise: input.amountPaise,
    });
    return {
      id: `rfnd_mock${randomBytes(8).toString("hex")}`,
      paymentId: input.paymentId,
      amountPaise: input.amountPaise,
      currency: "INR",
      status: "processed",
    };
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    return verifyPaymentSignature({ secret: mockSecret, ...input });
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return verifyRawWebhookSignature({
      secret: mockWebhookSecret,
      rawBody,
      signature,
    });
  }

  completePayment(providerOrderId: string): {
    providerPaymentId: string;
    providerOrderId: string;
    signature: string;
  } {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new SafeProviderError("PAYMENT_ORDER_NOT_FOUND", 404);
    const providerPaymentId = `pay_mock${randomBytes(8).toString("hex")}`;
    this.payments.set(providerPaymentId, {
      id: providerPaymentId,
      orderId: providerOrderId,
      amountPaise: order.amountPaise,
      currency: "INR",
      status: "captured",
      captured: true,
      method: "mock",
      amountRefundedPaise: 0,
    });
    return {
      providerPaymentId,
      providerOrderId,
      signature: paymentSignature(mockSecret, providerOrderId, providerPaymentId),
    };
  }

  setPayment(payment: ProviderPayment): void {
    this.payments.set(payment.id, payment);
  }
}
