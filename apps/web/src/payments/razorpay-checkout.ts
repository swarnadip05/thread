import type { PaymentCheckoutDto } from "@thread/types";

export interface RazorpaySuccess {
  readonly razorpay_payment_id: string;
  readonly razorpay_order_id: string;
  readonly razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email?: string; contact?: string };
  theme: { color: string };
  retry: { enabled: boolean };
  modal: { confirm_close: boolean; ondismiss(): void };
  handler(response: RazorpaySuccess): void;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", listener: () => void): void;
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Secure payment window could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function openRazorpayCheckout(
  checkout: PaymentCheckoutDto,
  handlers: {
    onDismiss(): void;
    onFailure(): void;
    onSuccess(response: RazorpaySuccess): void;
  },
): void {
  if (!window.Razorpay || !checkout.keyId) throw new Error("Secure payment window is unavailable.");
  const instance = new window.Razorpay({
    key: checkout.keyId,
    amount: checkout.amountPaise,
    currency: checkout.currency,
    name: checkout.brandName,
    description: checkout.description,
    order_id: checkout.providerOrderId,
    prefill: {
      name: checkout.customer.name,
      ...(checkout.customer.email ? { email: checkout.customer.email } : {}),
      ...(checkout.customer.phone ? { contact: checkout.customer.phone } : {}),
    },
    theme: { color: "#E8B923" },
    retry: { enabled: true },
    modal: { confirm_close: true, ondismiss: handlers.onDismiss },
    handler: handlers.onSuccess,
  });
  instance.on("payment.failed", handlers.onFailure);
  instance.open();
}
