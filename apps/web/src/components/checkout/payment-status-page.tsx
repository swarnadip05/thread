"use client";

import Link from "next/link";
import type { PaymentStatusDto } from "@thread/types";
import { Button, ErrorState, Price, Skeleton } from "@thread/ui";
import { CheckCircle2, Clock3, ReceiptText, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { clearCart, clearCheckoutAttempt } from "@/checkout/cart-storage";

export function PaymentStatusPage({ checkoutSessionId }: { checkoutSessionId: string }) {
  const auth = useAuth();
  const [status, setStatus] = useState<PaymentStatusDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = auth.accessToken;
    if (!accessToken) return;
    let active = true;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await apiRequest<PaymentStatusDto>(
          `/payments/checkout-sessions/${checkoutSessionId}/status`,
          accessToken,
        );
        if (!active) return;
        setStatus(next);
        setError("");
        if (next.status === "captured" || next.status === "refunded") {
          clearCart();
          clearCheckoutAttempt();
          return;
        }
        if (next.status !== "failed") timer = window.setTimeout(() => void poll(), 3_000);
      } catch (pollError) {
        if (!active) return;
        setError(
          pollError instanceof Error ? pollError.message : "Payment status could not be checked.",
        );
        timer = window.setTimeout(() => void poll(), 5_000);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [auth.accessToken, checkoutSessionId]);

  if (!status && !error)
    return (
      <div className="shell-container py-16">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="mx-auto size-12 rounded-full" />
          <Skeleton className="mx-auto h-10 w-72" />
          <Skeleton className="h-52 w-full" />
        </div>
      </div>
    );
  if (!status)
    return (
      <div className="shell-container py-16">
        <ErrorState description={error} title="Payment verification unavailable" />
      </div>
    );

  if (status.status === "failed")
    return (
      <div className="shell-container py-16">
        <section className="mx-auto max-w-2xl rounded-lg border border-error/20 bg-error/5 p-8 text-center">
          <XCircle aria-hidden="true" className="mx-auto size-12 text-error" />
          <h1 className="mt-5 text-3xl font-semibold">Payment failed</h1>
          <p className="mt-3 text-sm text-muted">{status.message}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/checkout">Rebuild checkout</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/men">Continue shopping</Link>
            </Button>
          </div>
        </section>
      </div>
    );

  if (status.receipt)
    return (
      <div className="shell-container py-16">
        <section className="mx-auto max-w-2xl rounded-lg border border-success/20 bg-success/5 p-8">
          <CheckCircle2 aria-hidden="true" className="size-12 text-success" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-success">
            Payment verified
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{status.receipt.orderNumber}</h1>
          <dl className="mt-7 grid gap-4 border-y border-success/15 py-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Amount received</dt>
              <dd className="mt-1 font-semibold">
                <Price amount={status.receipt.amountPaise} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">Order status</dt>
              <dd className="mt-1 font-semibold capitalize">
                {status.receipt.status.replaceAll("_", " ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Payment reference</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {status.receipt.providerPaymentId ?? "Provider verification"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Provider</dt>
              <dd className="mt-1 font-semibold capitalize">{status.receipt.provider}</dd>
            </div>
          </dl>
          <Button asChild className="mt-7">
            <Link href="/account">
              <ReceiptText aria-hidden="true" className="size-5" /> View account
            </Link>
          </Button>
        </section>
      </div>
    );

  return (
    <div className="shell-container py-16">
      <section
        aria-live="polite"
        className="mx-auto max-w-2xl rounded-lg border border-gold/30 bg-gold/10 p-8 text-center"
      >
        <Clock3 aria-hidden="true" className="mx-auto size-12 text-gold-dark" />
        <h1 className="mt-5 text-3xl font-semibold">Payment verification in progress</h1>
        <p className="mt-3 text-sm text-muted">
          {status.message} You can safely leave this page and return while THREAD checks the
          provider.
        </p>
        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
        <Button asChild className="mt-7" variant="outline">
          <Link href="/checkout">Return to checkout</Link>
        </Button>
      </section>
    </div>
  );
}
