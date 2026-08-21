export type ProviderPaymentStatus = "created" | "authorized" | "captured" | "failed" | "refunded";

export interface ProviderOrder {
  readonly id: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly status: "created" | "attempted" | "paid";
}

export interface ProviderPayment {
  readonly id: string;
  readonly orderId: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly status: ProviderPaymentStatus;
  readonly captured: boolean;
  readonly method?: string;
  readonly amountRefundedPaise: number;
}

export interface ProviderRefund {
  readonly id: string;
  readonly paymentId: string;
  readonly amountPaise: number;
  readonly currency: "INR";
  readonly status: "pending" | "processed" | "failed";
}

export interface PaymentProvider {
  readonly kind: "razorpay" | "mock";
  readonly publicKeyId?: string;
  createOrder(input: {
    amountPaise: number;
    currency: "INR";
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderOrder>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  refundPayment(input: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderRefund>;
  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

export class SafeProviderError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message = "The payment provider could not complete the request.",
  ) {
    super(message);
    this.name = "SafeProviderError";
  }
}
