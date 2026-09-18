"use client";

import { useRouter } from "next/navigation";
import type { CheckoutSessionDto, PaymentCheckoutDto, PaymentStatusDto } from "@thread/types";
import { Button } from "@thread/ui";
import { CreditCard, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
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
    <section className="rounded-lg border border-gold/40 bg-paper p-5 shadow-subtle">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-ink text-gold font-bold text-sm">
            SC
          </div>
          <div>
            <h2 className="font-semibold text-ink">Snap Cart Razorpay Gateway</h2>
            <p className="text-xs text-muted">
              Merchant: <strong>Snap Cart</strong> • MID: <code className="font-mono text-xs bg-ink/5 px-1 rounded">TcQzLflfwHCkgu</code>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
          <ShieldCheck aria-hidden="true" className="size-3.5" /> Verified
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs text-charcoal/80">
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1 font-semibold text-success">UPI</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">Google Pay</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">PhonePe</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">Paytm</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">Cards</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">NetBanking</span>
        <span className="rounded border border-ink/10 bg-ivory px-2 py-1">Apple Pay</span>
      </div>

      <p className="mt-3 text-xs text-muted">
        Your payment is encrypted and processed securely by Razorpay. THREAD never stores your card number, CVV or UPI PIN.
      </p>

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1 font-semibold"
          disabled={busy}
          onClick={() => void pay()}
          size="lg"
          variant="gold"
        >
          {busy ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <CreditCard aria-hidden="true" className="size-5" />
          )}
          {busy
            ? "Preparing secure payment…"
            : `Pay Now • ₹${(session.totals.totalPaise / 100).toLocaleString("en-IN")}`}
        </Button>

        <a
          href="https://razorpay.me/@threadstore323"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/20 bg-paper px-4 py-3 text-sm font-semibold text-ink hover:bg-ivory transition-colors"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Pay on razorpay.me/@threadstore323
        </a>
      </div>

      {message ? (
        <p aria-live="polite" className="mt-3 text-sm text-muted">
          {message}
        </p>
      ) : null}
    </section>
  );
}
