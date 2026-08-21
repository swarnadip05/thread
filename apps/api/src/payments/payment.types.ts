import type {
  OrderDto,
  PaymentCheckoutDto,
  PaymentProviderKind,
  PaymentStatus,
  RefundDto,
} from "@thread/types";

import type {
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
} from "./providers/payment.provider.js";

export interface PaymentView {
  readonly id: string;
  readonly checkoutSessionId: string;
  readonly orderId: string;
  readonly userId: string;
  readonly provider: PaymentProviderKind | "cod";
  readonly providerOrderId?: string;
  readonly providerPaymentId?: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly status: PaymentStatus;
  readonly idempotencyKeyHash: string;
  readonly creationToken?: string;
  readonly creationStartedAt?: Date;
  readonly providerVerifiedAt?: Date;
  readonly capturedAt?: Date;
  readonly method?: string;
  readonly amountRefundedPaise: number;
  readonly failureCode?: string;
  readonly createdAt: Date;
}

export interface PaymentOrderPreparation {
  readonly payment: PaymentView;
  readonly creationToken?: string;
}

export interface PaymentRepository {
  getCheckoutIdentity(userId: string): Promise<{
    readonly brandName: string;
    readonly name: string;
    readonly email?: string;
    readonly phone?: string;
  }>;
  acquireProviderOrderCreation(input: {
    order: OrderDto;
    checkoutSessionId: string;
    userId: string;
    provider: PaymentProviderKind;
    idempotencyKeyHash: string;
  }): Promise<PaymentOrderPreparation>;
  attachProviderOrder(input: {
    paymentId: string;
    creationToken: string;
    providerOrder: ProviderOrder;
  }): Promise<PaymentView>;
  abandonProviderOrderCreation(paymentId: string, creationToken: string): Promise<void>;
  findForUser(checkoutSessionId: string, userId: string): Promise<PaymentView | null>;
  findByProviderOrder(
    provider: PaymentProviderKind,
    providerOrderId: string,
  ): Promise<PaymentView | null>;
  recordSignatureVerification(input: {
    paymentId: string;
    providerPaymentId: string;
  }): Promise<PaymentView>;
  recordProviderPayment(input: {
    paymentId: string;
    payment: ProviderPayment;
    status: "authorized" | "pending_verification";
  }): Promise<PaymentView>;
  markPaymentFailed(input: {
    paymentId: string;
    failureCode: string;
    providerPaymentId?: string;
  }): Promise<PaymentView>;
  registerWebhook(input: {
    provider: PaymentProviderKind;
    eventId: string;
    payloadHash: string;
    eventType: string;
    providerOrderId?: string;
    providerPaymentId?: string;
  }): Promise<{ readonly id: string; readonly duplicate: boolean }>;
  completeWebhook(
    id: string,
    status: "processed" | "ignored" | "failed",
    input?: { failureCode?: string; relatedOrderId?: string },
  ): Promise<void>;
  findCapturedForOrder(orderId: string): Promise<PaymentView | null>;
  findPendingReconciliation(limit: number, staleBefore: Date): Promise<readonly PaymentView[]>;
  findRefundForOrder(orderId: string): Promise<RefundDto | null>;
  saveRefund(input: {
    order: OrderDto;
    payment: PaymentView;
    actorId: string;
    reason: string;
    receipt: string;
    refund: ProviderRefund;
  }): Promise<RefundDto>;
  applyProcessedRefund(providerRefundId: string, providerPaymentId: string): Promise<void>;
}

export interface PaymentCheckoutResult {
  readonly checkout: PaymentCheckoutDto;
  readonly reused: boolean;
}
