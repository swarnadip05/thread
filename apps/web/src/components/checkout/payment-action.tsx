"use client";

import { useRouter } from "next/navigation";
import type { CheckoutSessionDto, PaymentCheckoutDto, PaymentStatusDto } from "@thread/types";
import { Button } from "@thread/ui";
import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import {
  loadRazorpayCheckout,
  openRazorpayCheckout,
  type RazorpaySuccess,
} from "@/payments/razorpay-checkout";

export function PaymentAction({
  accessToken,
  session,
}: {
  accessToken: string;
  session: CheckoutSessionDto;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const callback = async (response: RazorpaySuccess) => {
    setMessage("Secure callback received. Verifying payment…");
    try {
      await apiRequest<PaymentStatusDto>(
        `/payments/checkout-sessions/${session.id}/callback`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            providerPaymentId: response.razorpay_payment_id,
            providerOrderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
          }),
        },
      );
    } catch {
      setMessage("Callback received. Waiting for server-to-server verification…");
    } finally {
      router.push(`/checkout/payment/${session.id}`);
    }
  };

  const pay = async () => {
    setBusy(true);
    setMessage("");
    try {
      const checkout = await apiRequest<PaymentCheckoutDto>(
        `/payments/checkout-sessions/${session.id}/create`,
        accessToken,
        {
          method: "POST",
          headers: { "idempotency-key": `payment-${session.id}` },
        },
      );
      if (checkout.provider === "mock") {
        setMessage("Completing local mock payment…");
        await apiRequest<PaymentStatusDto>(
          `/payments/checkout-sessions/${session.id}/mock-complete`,
          accessToken,
          { method: "POST" },
        );
        router.push(`/checkout/payment/${session.id}`);
        return;
      }
      await loadRazorpayCheckout();
      openRazorpayCheckout(checkout, {
        onDismiss: () => {
          setBusy(false);
          setMessage("Payment window closed. Your order was not marked paid; you can retry.");
        },
        onFailure: () => {
          setBusy(false);
          setMessage("The payment attempt failed. Waiting for secure provider verification.");
        },
        onSuccess: (response) => void callback(response),
      });
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Payment could not be started.");
    }
  };

  return (
    <section className="rounded-lg border border-success/20 bg-success/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-success" />
        <div>
          <h2 className="font-semibold">Pay securely with Razorpay</h2>
          <p className="mt-1 text-sm text-muted">
            Available UPI, QR and card methods are controlled by the merchant account. THREAD never
            receives card details, CVV or UPI PINs.
          </p>
        </div>
      </div>
      <Button className="mt-5 w-full" disabled={busy} onClick={() => void pay()} size="lg">
        {busy ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <CreditCard aria-hidden="true" className="size-5" />
        )}
        {busy ? "Preparing secure payment…" : "Pay server-confirmed total"}
      </Button>
      {message ? (
        <p aria-live="polite" className="mt-3 text-sm text-muted">
          {message}
        </p>
      ) : null}
    </section>
  );
}
