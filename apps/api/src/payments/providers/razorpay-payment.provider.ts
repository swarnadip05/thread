import type {
  PaymentProvider,
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
} from "./payment.provider.js";
import { SafeProviderError } from "./payment.provider.js";
import { verifyPaymentSignature, verifyRawWebhookSignature } from "./signatures.js";

const razorpayApi = "https://api.razorpay.com/v1";

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
  return value as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, name: string): string {
  const field = value[name];
  if (typeof field !== "string") throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
  return field;
}

function integerField(value: Record<string, unknown>, name: string): number {
  const field = value[name];
  if (!Number.isInteger(field)) throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
  return field as number;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly kind = "razorpay" as const;

  constructor(
    readonly publicKeyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  async createOrder(input: {
    amountPaise: number;
    currency: "INR";
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderOrder> {
    let response: unknown;
    try {
      response = await this.request("/orders", {
        method: "POST",
        body: JSON.stringify({
          amount: input.amountPaise,
          currency: input.currency,
          receipt: input.receipt,
          notes: input.notes,
          partial_payment: false,
        }),
      });
    } catch (error) {
      if (!(error instanceof SafeProviderError) || error.code !== "PAYMENT_PROVIDER_REJECTED")
        throw error;
      const recovered = await this.findOrderByReceipt(input.receipt);
      if (!recovered) throw error;
      response = recovered;
    }
    const body = record(response);
    const status = stringField(body, "status");
    if (!["created", "attempted", "paid"].includes(status))
      throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
    return {
      id: stringField(body, "id"),
      amountPaise: integerField(body, "amount"),
      currency: "INR",
      status: status as ProviderOrder["status"],
    };
  }

  private async findOrderByReceipt(receipt: string): Promise<unknown | null> {
    const collection = record(
      await this.request(`/orders?receipt=${encodeURIComponent(receipt)}&count=1`),
    );
    if (!Array.isArray(collection.items)) return null;
    const match = collection.items.find((item) => record(item).receipt === receipt);
    return match ?? null;
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    const body = record(await this.request(`/payments/${encodeURIComponent(paymentId)}`));
    const status = stringField(body, "status");
    if (!["created", "authorized", "captured", "failed", "refunded"].includes(status))
      throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
    return {
      id: stringField(body, "id"),
      orderId: stringField(body, "order_id"),
      amountPaise: integerField(body, "amount"),
      currency: "INR",
      status: status as ProviderPayment["status"],
      captured: body.captured === true,
      ...(typeof body.method === "string" ? { method: body.method } : {}),
      amountRefundedPaise:
        Number.isInteger(body.amount_refunded) && (body.amount_refunded as number) >= 0
          ? (body.amount_refunded as number)
          : 0,
    };
  }

  async refundPayment(input: {
    paymentId: string;
    amountPaise: number;
    receipt: string;
    notes: Readonly<Record<string, string>>;
  }): Promise<ProviderRefund> {
    const body = record(
      await this.request(`/payments/${encodeURIComponent(input.paymentId)}/refund`, {
        method: "POST",
        body: JSON.stringify({
          amount: input.amountPaise,
          speed: "normal",
          receipt: input.receipt,
          notes: input.notes,
        }),
      }),
    );
    const status = stringField(body, "status");
    if (!["pending", "processed", "failed"].includes(status))
      throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
    return {
      id: stringField(body, "id"),
      paymentId: stringField(body, "payment_id"),
      amountPaise: integerField(body, "amount"),
      currency: "INR",
      status: status as ProviderRefund["status"],
    };
  }

  verifyCheckoutSignature(input: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
  }): boolean {
    return verifyPaymentSignature({ secret: this.keySecret, ...input });
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    return verifyRawWebhookSignature({ secret: this.webhookSecret, rawBody, signature });
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${razorpayApi}${path}`, {
        ...init,
        headers: {
          authorization: `Basic ${Buffer.from(`${this.publicKeyId}:${this.keySecret}`).toString("base64")}`,
          "content-type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SafeProviderError("PAYMENT_PROVIDER_UNAVAILABLE", 503);
    }
    if (!response.ok) {
      throw new SafeProviderError("PAYMENT_PROVIDER_REJECTED", response.status >= 500 ? 503 : 502);
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new SafeProviderError("INVALID_PROVIDER_RESPONSE", 502);
    }
  }
}
