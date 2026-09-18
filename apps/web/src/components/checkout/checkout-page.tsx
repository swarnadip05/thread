"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CheckoutAddressDto,
  CheckoutBootstrapDto,
  CheckoutPaymentMethod,
  CheckoutSessionDto,
  OrderDto,
  PaymentCheckoutDto,
  PaymentStatusDto,
} from "@thread/types";
import { Button, EmptyState, ErrorState, Input, Price, Skeleton } from "@thread/ui";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import {
  checkoutIdempotencyKey,
  clearCart,
  clearCheckoutAttempt,
  readCart,
  readCheckoutSessionId,
  storeCheckoutSessionId,
  type StoredCartLine,
} from "@/checkout/cart-storage";
import {
  loadRazorpayCheckout,
  openRazorpayCheckout,
  type RazorpaySuccess,
} from "@/payments/razorpay-checkout";

import { CheckoutAddressForm } from "./checkout-address-form";
import { CheckoutSummary } from "./checkout-summary";
import { ReservationTimer } from "./reservation-timer";

export function CheckoutPage({ gstin }: { gstin: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<StoredCartLine[]>([]);
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrapDto | null>(null);
  const [addressId, setAddressId] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("cod");
  const [policyAccepted, setPolicyAccepted] = useState(true);
  const [session, setSession] = useState<CheckoutSessionDto | null>(null);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      if (auth.status === "unknown") {
        await auth.refresh();
      }
      const [data, storedSessionId] = await Promise.all([
        apiRequest<CheckoutBootstrapDto>("/checkout/bootstrap", auth.accessToken ?? ""),
        Promise.resolve(readCheckoutSessionId()),
      ]);
      setBootstrap(data);
      const currentCart = readCart();
      setCart(currentCart);
      const initialAddress =
        data.addresses.find((address) => address.isDefault)?.id ?? data.addresses[0]?.id ?? "";
      setAddressId(initialAddress);
      setShippingMethodId(data.shippingMethods[0]?.id ?? "");

      if (data.addresses.length === 0) {
        setShowAddressForm(true);
      }

      if (storedSessionId && auth.accessToken) {
        try {
          const existing = await apiRequest<CheckoutSessionDto>(
            `/checkout/sessions/${storedSessionId}`,
            auth.accessToken,
          );
          const sessionVariantIds = new Set(existing.items.map((i) => i.variantId));
          const cartVariantIds = new Set(currentCart.map((c) => c.variantId));
          const setsMatch =
            sessionVariantIds.size === cartVariantIds.size &&
            [...cartVariantIds].every((id) => sessionVariantIds.has(id));
          if (setsMatch && existing.status === "active") {
            setSession(existing);
          } else {
            clearCheckoutAttempt();
          }
        } catch {
          clearCheckoutAttempt();
        }
      }
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Checkout could not be loaded.");
    }
  }, [auth.accessToken, auth.refresh, auth.status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addAddress = (address: CheckoutAddressDto) => {
    setBootstrap((current) =>
      current ? { ...current, addresses: [address, ...current.addresses] } : current,
    );
    setAddressId(address.id);
    setShowAddressForm(false);
    setError((prev) => (prev.toLowerCase().includes("address") ? "" : prev));
  };

  // Launch online payment with Razorpay
  const handleOnlinePayment = async (activeSession: CheckoutSessionDto, token: string) => {
    setStatusMessage("Opening secure payment window…");
    try {
      const checkout = await apiRequest<PaymentCheckoutDto>(
        `/payments/checkout-sessions/${activeSession.id}/create`,
        token,
        {
          method: "POST",
          headers: { "idempotency-key": `payment-${activeSession.id}` },
        },
      );

      if (checkout.provider === "mock") {
        await apiRequest<PaymentStatusDto>(
          `/payments/checkout-sessions/${activeSession.id}/mock-complete`,
          token,
          { method: "POST" },
        );
        router.push(`/checkout/payment/${activeSession.id}`);
        return;
      }

      await loadRazorpayCheckout();
      openRazorpayCheckout(checkout, {
        onDismiss: () => {
          setBusy(false);
          setStatusMessage("Payment cancelled. You can retry paying whenever you are ready.");
        },
        onFailure: () => {
          setBusy(false);
          setError("Payment was not completed. Please retry or choose Cash on Delivery.");
        },
        onSuccess: async (response: RazorpaySuccess) => {
          setStatusMessage("Payment received! Confirming your order…");
          try {
            await apiRequest<PaymentStatusDto>(
              `/payments/checkout-sessions/${activeSession.id}/callback`,
              token,
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
            // Callback processing completed
          } finally {
            clearCart();
            setCart([]);
            clearCheckoutAttempt();
            router.push(`/checkout/payment/${activeSession.id}`);
          }
        },
      });
    } catch (payError) {
      setBusy(false);
      setError(
        payError instanceof Error ? payError.message : "Failed to initiate online payment.",
      );
    }
  };

  // Primary action button (1-click for COD, direct popup for Online)
  const handlePlaceOrder = async () => {
    if (!bootstrap) return;

    if (!addressId) {
      setShowAddressForm(true);
      setError("Please fill in your delivery address before placing the order.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!auth.accessToken) {
      setShowAddressForm(true);
      setError("Please save your delivery address first by clicking 'Deliver to this address'.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!shippingMethodId) {
      setError("Please select a delivery method.");
      return;
    }

    setBusy(true);
    setError("");
    setStatusMessage("Securing your order…");

    try {
      // 1. Create or retrieve active session
      let currentSession = session;
      if (!currentSession || currentSession.status !== "active") {
        currentSession = await apiRequest<CheckoutSessionDto>(
          "/checkout/sessions",
          auth.accessToken,
          {
            method: "POST",
            headers: { "idempotency-key": checkoutIdempotencyKey() },
            body: JSON.stringify({
              addressId,
              shippingMethodId,
              ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
              paymentMethod,
              codConfirmationAccepted: true,
              policyAccepted: true,
              lines: cart.map((line) => ({
                variantId: line.variantId,
                quantity: line.quantity,
                ...(line.observedUnitPricePaise !== undefined
                  ? { observedUnitPricePaise: line.observedUnitPricePaise }
                  : {}),
              })),
            }),
          },
        );
        setSession(currentSession);
        storeCheckoutSessionId(currentSession.id);
      }

      // 2. Action based on payment method
      if (paymentMethod === "cod") {
        setStatusMessage("Confirming Cash on Delivery order…");
        const confirmed = await apiRequest<OrderDto>(
          `/checkout/sessions/${currentSession.id}/confirm-cod`,
          auth.accessToken,
          {
            method: "POST",
            headers: { "idempotency-key": `confirm-${currentSession.id}` },
          },
        );
        setOrder(confirmed);
        clearCart();
        setCart([]);
        clearCheckoutAttempt();
        setSession(null);
      } else {
        // Online Payment via Razorpay
        await handleOnlinePayment(currentSession, auth.accessToken);
      }
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? orderError.message
          : "Order could not be confirmed. Please try again.",
      );
    } finally {
      setBusy(false);
      setStatusMessage("");
    }
  };

  const cancel = async () => {
    if (!auth.accessToken || !session) return;
    setBusy(true);
    try {
      const cancelled = await apiRequest<CheckoutSessionDto>(
        `/checkout/sessions/${session.id}/cancel`,
        auth.accessToken,
        { method: "POST" },
      );
      setSession(cancelled);
      clearCheckoutAttempt();
    } finally {
      setBusy(false);
    }
  };

  const recover = () => {
    clearCheckoutAttempt();
    setSession(null);
    setError("");
  };

  if (!bootstrap && !error)
    return (
      <div className="shell-container grid gap-8 py-10 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );

  if (error && !bootstrap)
    return (
      <div className="shell-container py-16">
        <ErrorState description={error} title="Checkout is unavailable" />
      </div>
    );

  // Success Screen
  if (order)
    return (
      <div className="shell-container py-16">
        <section className="mx-auto max-w-2xl rounded-2xl border border-success/30 bg-success/5 p-8 text-center shadow-raised">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-16 text-success" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-success">
            Order Placed Successfully!
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {order.orderNumber}
          </h1>
          <p className="mt-3 text-sm text-charcoal">
            Thank you for ordering with THREAD by Snap Cart. Your Cash on Delivery order has been
            recorded and our team is preparing it for dispatch.
          </p>

          <div className="mt-6 rounded-lg border border-ink/10 bg-paper p-4 text-left text-sm">
            <p className="font-semibold text-ink">Delivery Address:</p>
            <p className="mt-1 text-muted">
              {order.address.fullName} • {order.address.phone}
            </p>
            <p className="text-muted">
              {order.address.addressLine1}
              {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""},{" "}
              {order.address.city}, {order.address.state} {order.address.postalCode}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" variant="gold">
              <Link href="/men">Continue Shopping</Link>
            </Button>
            <a
              href={`https://wa.me/916289332132?text=${encodeURIComponent(
                `Hi Snap Cart, I just placed order ${order.orderNumber}. Please update me on delivery status.`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-5 py-3 text-sm font-semibold text-success hover:bg-success/20 transition-colors"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              WhatsApp Support
            </a>
          </div>
        </section>
      </div>
    );

  if (cart.length === 0 && !session)
    return (
      <div className="shell-container py-16">
        <EmptyState
          action={
            <Button asChild>
              <Link href="/men">Continue shopping</Link>
            </Button>
          }
          description="Add a product variant before starting checkout."
          title="Your cart is empty"
        />
      </div>
    );

  // Compute totals
  const cartSubtotal = cart.reduce(
    (sum, line) => sum + (line.observedUnitPricePaise ?? 0) * line.quantity,
    0,
  );
  const selectedMethod = bootstrap?.shippingMethods.find((m) => m.id === shippingMethodId);
  const estimatedShipping = selectedMethod?.ratePaise ?? 0;
  const taxRate = paymentMethod === "cod" ? 5 : 3;
  const estimatedTax = Math.round((cartSubtotal * taxRate) / 100);
  const estimatedTotal =
    session?.totals.totalPaise ??
    (cartSubtotal > 0 ? cartSubtotal + estimatedShipping + estimatedTax : 0);

  const inactiveSession = session && session.status !== "active";

  return (
    <div className="shell-container pb-40 pt-8 lg:pb-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Secure checkout</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Confirm delivery and totals
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {/* Active Reservation Notice */}
          {session?.status === "active" ? (
            <section className="rounded-lg border border-gold/40 bg-gold/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock3 aria-hidden="true" className="size-4 text-gold" />
                  <span>
                    Stock reserved for{" "}
                    <strong>
                      <ReservationTimer
                        expiresAt={session.expiresAt}
                        onExpired={() => void load()}
                      />
                    </strong>
                  </span>
                </div>
                <Button
                  disabled={busy}
                  onClick={() => void cancel()}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </section>
          ) : null}

          {inactiveSession ? (
            <section className="rounded-lg border border-error/25 bg-error/5 p-5">
              <h2 className="font-semibold">This checkout session is {session.status.replace("_", " ")}</h2>
              <p className="mt-2 text-sm text-muted">
                Start again to re-check prices, delivery rules and stock.
              </p>
              <Button className="mt-4" onClick={recover} variant="outline">
                Rebuild checkout
              </Button>
            </section>
          ) : null}

          {/* Delivery Address */}
          <section className="rounded-lg border border-ink/10 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <MapPin aria-hidden="true" className="size-5" /> Delivery address
                </h2>
                <p className="mt-1 text-sm text-muted">Select a saved address or add a new one.</p>
              </div>
              <Button
                onClick={() => setShowAddressForm((value) => !value)}
                size="sm"
                variant="outline"
              >
                {showAddressForm ? "Close form" : "Add address"}
              </Button>
            </div>
            {showAddressForm ? (
              <CheckoutAddressForm
                accessToken={auth.accessToken}
                onCancel={
                  bootstrap!.addresses.length > 0 ? () => setShowAddressForm(false) : undefined
                }
                onCreated={addAddress}
              />
            ) : null}
            {bootstrap!.addresses.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {bootstrap!.addresses.map((address) => (
                  <label
                    className="flex cursor-pointer gap-3 rounded-md border border-ink/15 p-4 has-[:checked]:border-ink has-[:checked]:bg-ivory"
                    key={address.id}
                  >
                    <input
                      checked={addressId === address.id}
                      name="address"
                      onChange={() => setAddressId(address.id)}
                      type="radio"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">{address.fullName}</span>
                      <span className="mt-1 block text-muted">
                        {address.addressLine1}
                        {address.addressLine2 ? `, ${address.addressLine2}` : ""}, {address.city},{" "}
                        {address.state} {address.postalCode}
                      </span>
                      <span className="mt-1 block text-muted">{address.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : !showAddressForm ? (
              <div className="mt-4 rounded-md border border-dashed border-ink/20 p-6 text-center">
                <p className="text-sm text-muted">No delivery address entered yet.</p>
                <Button
                  className="mt-3"
                  onClick={() => setShowAddressForm(true)}
                  size="sm"
                  variant="gold"
                >
                  Enter Delivery Address
                </Button>
              </div>
            ) : null}
          </section>

          {/* Delivery Method */}
          <section className="rounded-lg border border-ink/10 p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Truck aria-hidden="true" className="size-5" /> Delivery method
            </h2>
            {bootstrap!.shippingMethods.length ? (
              <div className="mt-5 grid gap-3">
                {bootstrap!.shippingMethods.map((method) => (
                  <label
                    className="flex cursor-pointer justify-between gap-4 rounded-md border border-ink/15 p-4 has-[:checked]:border-ink has-[:checked]:bg-ivory"
                    key={method.id}
                  >
                    <span className="flex gap-3">
                      <input
                        checked={shippingMethodId === method.id}
                        name="shipping"
                        onChange={() => setShippingMethodId(method.id)}
                        type="radio"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{method.name}</span>
                        <span className="mt-1 block text-xs text-muted">{method.description}</span>
                      </span>
                    </span>
                    {method.ratePaise === 0 ? (
                      <span className="text-sm font-semibold text-success">Free</span>
                    ) : (
                      <Price amount={method.ratePaise} className="text-sm font-semibold" />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md bg-error/5 p-4 text-sm text-error">
                No active shipping method is configured.
              </p>
            )}
          </section>

          {/* Payment Method */}
          <section className="rounded-lg border border-ink/10 p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <PackageCheck aria-hidden="true" className="size-5" /> Payment Method & Coupon
            </h2>

            <label className="mt-5 grid gap-1 text-sm font-medium">
              Coupon code <span className="font-normal text-muted">(optional)</span>
              <Input
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Enter code"
                value={couponCode}
              />
            </label>

            <fieldset className="mt-6 grid gap-3">
              <legend className="text-sm font-semibold">Choose payment option</legend>

              {/* Cash on Delivery */}
              {bootstrap!.codEnabled ? (
                <label
                  className={`flex cursor-pointer gap-3.5 rounded-lg border p-4 transition-colors ${
                    paymentMethod === "cod"
                      ? "border-ink bg-ivory shadow-xs ring-1 ring-ink/20"
                      : "border-ink/15 hover:border-ink/30"
                  }`}
                >
                  <input
                    checked={paymentMethod === "cod"}
                    className="mt-1 size-4 accent-ink"
                    name="payment"
                    onChange={() => setPaymentMethod("cod")}
                    type="radio"
                  />
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Banknote aria-hidden="true" className="size-4 text-ink" />
                      Cash on Delivery (COD)
                    </span>
                    <span className="rounded bg-ink/10 px-2 py-0.5 text-[0.68rem] font-bold text-charcoal">
                      + 5% tax
                    </span>
                  </div>
                </label>
              ) : null}

              {/* Online Payment */}
              <label
                className={`flex cursor-pointer gap-3.5 rounded-lg border p-4 transition-colors ${
                  paymentMethod === "payment_placeholder"
                    ? "border-ink bg-ivory shadow-xs ring-1 ring-gold/40"
                    : "border-ink/15 hover:border-ink/30"
                }`}
              >
                <input
                  checked={paymentMethod === "payment_placeholder"}
                  className="mt-1 size-4 accent-ink"
                  name="payment"
                  onChange={() => setPaymentMethod("payment_placeholder")}
                  type="radio"
                />
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard aria-hidden="true" className="size-4 text-ink" />
                    Online Payment (UPI, Cards, NetBanking)
                  </span>
                  <span className="rounded bg-success/15 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-success">
                    + 3% tax
                  </span>
                </div>
              </label>
            </fieldset>

            {/* Direct Razorpay Link & WhatsApp Help */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs text-charcoal">
                <span className="flex items-center gap-2">
                  <ExternalLink aria-hidden="true" className="size-4 text-gold shrink-0" />
                  Direct Payment Link:
                </span>
                <a
                  href="https://razorpay.me/@threadstore323"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-ink underline hover:text-gold ml-2"
                >
                  razorpay.me/@threadstore323
                </a>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-charcoal">
                <span className="flex items-center gap-2">
                  <MessageCircle aria-hidden="true" className="size-4 text-success shrink-0" />
                  Need help with your order?
                </span>
                <a
                  href={`https://wa.me/916289332132?text=${encodeURIComponent(
                    "Hi, I need assistance with my order on THREAD.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-success underline hover:text-success/80 ml-2"
                >
                  WhatsApp Us
                </a>
              </div>
            </div>
          </section>

          {/* Policy Accept */}
          <label className="flex items-start gap-3 rounded-lg border border-ink/10 p-5 text-sm">
            <input
              checked={policyAccepted}
              className="mt-0.5 size-5 accent-gold"
              onChange={(event) => setPolicyAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>
              I acknowledge the{" "}
              <Link className="font-semibold underline" href="/shipping-delivery">
                shipping
              </Link>
              ,{" "}
              <Link className="font-semibold underline" href="/returns-exchanges">
                returns
              </Link>{" "}
              and order cancellation policies.
            </span>
          </label>

          {/* Status / Error Banner */}
          {statusMessage ? (
            <div className="flex items-center gap-2 rounded-md bg-gold/10 p-4 text-sm font-medium text-ink">
              <LoaderCircle className="size-4 animate-spin" />
              {statusMessage}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md bg-error/5 p-4 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* MAIN ORDER CONFIRMATION BUTTON - PLACED DIRECTLY AT THE BOTTOM NEAR CUSTOMER'S EYES */}
          <div className="pt-2">
            <Button
              className="w-full gap-2 font-bold text-base py-6 shadow-md"
              disabled={busy || bootstrap!.shippingMethods.length === 0}
              onClick={() => void handlePlaceOrder()}
              size="lg"
              variant="gold"
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-5 animate-spin" />
                  {statusMessage || "Processing your order…"}
                </>
              ) : paymentMethod === "cod" ? (
                <>
                  <ShieldCheck aria-hidden="true" className="size-5" />
                  Place Cash on Delivery Order
                  {estimatedTotal > 0 && (
                    <span className="ml-1 font-normal opacity-90">
                      — Pay <Price amount={estimatedTotal} className="inline text-base font-bold" />
                    </span>
                  )}
                </>
              ) : (
                <>
                  <CreditCard aria-hidden="true" className="size-5" />
                  Proceed to Online Payment
                  {estimatedTotal > 0 && (
                    <span className="ml-1 font-normal opacity-90">
                      — <Price amount={estimatedTotal} className="inline text-base font-bold" />
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Order Summary Sidebar */}
        <CheckoutSummary
          cart={cart}
          deliveryPaise={estimatedShipping}
          gstin={gstin}
          paymentMethod={paymentMethod}
          session={session}
        />
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-16 z-header flex items-center justify-between gap-3 border-t bg-paper p-3 shadow-raised lg:hidden">
        <div>
          <p className="text-xs text-muted">
            Total ({paymentMethod === "cod" ? "COD" : "Online"})
          </p>
          <Price amount={estimatedTotal} className="font-bold text-base" />
        </div>
        <Button
          className="font-bold px-6"
          disabled={busy || bootstrap!.shippingMethods.length === 0}
          onClick={() => void handlePlaceOrder()}
          variant="gold"
        >
          {busy
            ? "Processing…"
            : paymentMethod === "cod"
              ? "Place COD Order"
              : "Pay Now"}
        </Button>
      </div>
    </div>
  );
}
