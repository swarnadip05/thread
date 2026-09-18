"use client";

import Link from "next/link";
import type {
  CheckoutAddressDto,
  CheckoutBootstrapDto,
  CheckoutPaymentMethod,
  CheckoutSessionDto,
  OrderDto,
} from "@thread/types";
import { Button, EmptyState, ErrorState, Input, Price, Skeleton } from "@thread/ui";
import { Banknote, Check, CheckCircle2, Clock3, CreditCard, MapPin, MessageCircle, PackageCheck, ShieldCheck, Truck } from "lucide-react";
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

import { CheckoutAddressForm } from "./checkout-address-form";
import { CheckoutSummary } from "./checkout-summary";
import { PaymentAction } from "./payment-action";
import { ReservationTimer } from "./reservation-timer";

export function CheckoutPage({ gstin }: { gstin: string }) {
  const auth = useAuth();
  const [cart, setCart] = useState<StoredCartLine[]>([]);
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrapDto | null>(null);
  const [addressId, setAddressId] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("payment_placeholder");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [codConfirmationAccepted, setCodConfirmationAccepted] = useState(false);
  const [session, setSession] = useState<CheckoutSessionDto | null>(null);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [busy, setBusy] = useState(false);
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

      // If user has no saved addresses, automatically open address form
      if (data.addresses.length === 0) {
        setShowAddressForm(true);
      }

      if (storedSessionId && auth.accessToken) {
        try {
          const existing = await apiRequest<CheckoutSessionDto>(
            `/checkout/sessions/${storedSessionId}`,
            auth.accessToken,
          );
          // Only restore session if cart items still match the session (prevent showing stale multi-item sessions)
          const sessionVariantIds = new Set(existing.items.map((i) => i.variantId));
          const cartVariantIds = new Set(currentCart.map((c) => c.variantId));
          const setsMatch =
            sessionVariantIds.size === cartVariantIds.size &&
            [...cartVariantIds].every((id) => sessionVariantIds.has(id));
          if (setsMatch && existing.status === "active") {
            setSession(existing);
          } else {
            // Cart changed or session expired — discard old session
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
    // Clear address error if any
    setError((prev) =>
      prev.toLowerCase().includes("address") ? "" : prev,
    );
  };

  const createCheckout = async () => {
    if (!bootstrap) return;

    // Address check: must have a selected address ID
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
    if (!shippingMethodId || !policyAccepted) {
      setError("Choose a delivery method, then acknowledge the store policies.");
      return;
    }
    if (paymentMethod === "cod" && bootstrap.codConfirmationRequired && !codConfirmationAccepted) {
      setError("Confirm the cash-on-delivery acknowledgement before placing the order.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await apiRequest<CheckoutSessionDto>("/checkout/sessions", auth.accessToken, {
        method: "POST",
        headers: { "idempotency-key": checkoutIdempotencyKey() },
        body: JSON.stringify({
          addressId,
          shippingMethodId,
          ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
          paymentMethod,
          codConfirmationAccepted,
          policyAccepted: true,
          lines: cart.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
            ...(line.observedUnitPricePaise !== undefined
              ? { observedUnitPricePaise: line.observedUnitPricePaise }
              : {}),
          })),
        }),
      });
      setSession(created);
      storeCheckoutSessionId(created.id);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Checkout could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmCod = async () => {
    if (!auth.accessToken || !session) return;
    setBusy(true);
    setError("");
    try {
      const confirmed = await apiRequest<OrderDto>(
        `/checkout/sessions/${session.id}/confirm-cod`,
        auth.accessToken,
        {
          method: "POST",
          headers: { "idempotency-key": `confirm-${session.id}` },
        },
      );
      setOrder(confirmed);
      clearCart();
      setCart([]);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "COD order could not be confirmed.",
      );
    } finally {
      setBusy(false);
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

  if (order)
    return (
      <div className="shell-container py-16">
        <section className="mx-auto max-w-2xl rounded-lg border border-success/20 bg-success/5 p-8 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-success" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-success">
            Order confirmed
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{order.orderNumber}</h1>
          <p className="mt-3 text-sm text-muted">
            Cash on delivery is recorded as pending. No online payment was collected.
          </p>
          <Button asChild className="mt-7">
            <Link href="/account">View account</Link>
          </Button>
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

  // Compute estimated totals for mobile bar and summary
  const cartSubtotal = cart.reduce(
    (sum, line) => sum + (line.observedUnitPricePaise ?? 0) * line.quantity,
    0,
  );
  const selectedMethod = bootstrap?.shippingMethods.find((m) => m.id === shippingMethodId);
  const estimatedShipping = selectedMethod?.ratePaise ?? 0;
  const taxRate = paymentMethod === "cod" ? 5 : 3;
  const estimatedTax = Math.round((cartSubtotal * taxRate) / 100);
  const estimatedTotal = cartSubtotal > 0 ? cartSubtotal + estimatedShipping + estimatedTax : 0;

  const inactiveSession = session && session.status !== "active";
  return (
    <div className="shell-container pb-40 pt-8 lg:pb-16">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Secure checkout</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        Confirm delivery and totals
      </h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {session?.status === "active" ? (
            <section className="rounded-lg border border-gold/40 bg-gold/10 p-5">
              <div className="flex items-start gap-3">
                <Clock3 aria-hidden="true" className="mt-0.5 size-5" />
                <div>
                  <h2 className="font-semibold">Stock reserved</h2>
                  <p className="mt-1 text-sm text-muted">
                    Reservation expires in{" "}
                    <ReservationTimer expiresAt={session.expiresAt} onExpired={() => void load()} />
                    .
                  </p>
                  {session.paymentMethod === "payment_placeholder" ? (
                    <p className="mt-2 text-sm">
                      Review the confirmed total below, then complete your online payment.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm">
                      Review the confirmed total and place your COD order.
                    </p>
                  )}
                </div>
              </div>
              <Button
                className="mt-4"
                disabled={busy}
                onClick={() => void cancel()}
                size="sm"
                variant="outline"
              >
                Cancel and release stock
              </Button>
              {session.paymentMethod === "cod" ? (
                <Button
                  className="ml-2 mt-4 font-semibold"
                  disabled={busy}
                  onClick={() => void confirmCod()}
                  size="sm"
                  variant="gold"
                >
                  <Check aria-hidden="true" className="size-4 mr-1.5" />
                  {busy ? "Confirming…" : "Confirm & Place COD Order"}
                </Button>
              ) : null}
            </section>
          ) : null}
          {session?.status === "active" &&
          session.paymentMethod === "payment_placeholder" &&
          auth.accessToken ? (
            <PaymentAction accessToken={auth.accessToken} session={session} />
          ) : null}
          {inactiveSession ? (
            <section className="rounded-lg border border-error/25 bg-error/5 p-5">
              <h2 className="font-semibold">This checkout is {session.status.replace("_", " ")}</h2>
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
              {!session ? (
                <Button
                  onClick={() => setShowAddressForm((value) => !value)}
                  size="sm"
                  variant="outline"
                >
                  {showAddressForm ? "Close form" : "Add address"}
                </Button>
              ) : null}
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
                      disabled={Boolean(session)}
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
                        disabled={Boolean(session)}
                        name="shipping"
                        onChange={() => setShippingMethodId(method.id)}
                        type="radio"
                      />
                      <span>
                        <span className="block text-sm font-semibold">{method.name}</span>
                        <span className="mt-1 block text-xs text-muted">{method.description}</span>
                      </span>
                    </span>
                    <Price amount={method.ratePaise} className="text-sm font-semibold" />
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md bg-error/5 p-4 text-sm text-error">
                No active shipping method is configured. An administrator must add a reviewed rate.
              </p>
            )}
          </section>

          {/* Payment Method */}
          <section className="rounded-lg border border-ink/10 p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <PackageCheck aria-hidden="true" className="size-5" /> Coupon and payment
            </h2>
            <label className="mt-5 grid gap-1 text-sm font-medium">
              Coupon code <span className="font-normal text-muted">(optional)</span>
              <Input
                disabled={Boolean(session)}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Enter code"
                value={couponCode}
              />
            </label>
            <fieldset className="mt-6 grid gap-3">
              <legend className="text-sm font-semibold">Choose payment method</legend>

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
                  disabled={Boolean(session)}
                  name="payment"
                  onChange={() => setPaymentMethod("payment_placeholder")}
                  type="radio"
                />
                <div className="flex flex-1 items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard aria-hidden="true" className="size-4 text-ink" />
                    Online Payment
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-success/15 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-success">
                      + 3% tax
                    </span>
                  </div>
                </div>
              </label>

              {/* COD */}
              {bootstrap!.codEnabled ? (
                <>
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
                      disabled={Boolean(session)}
                      name="payment"
                      onChange={() => setPaymentMethod("cod")}
                      type="radio"
                    />
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Banknote aria-hidden="true" className="size-4 text-ink" />
                        Cash on Delivery
                      </span>
                      <span className="rounded bg-ink/10 px-2 py-0.5 text-[0.68rem] font-bold text-charcoal">
                        + 5% tax
                      </span>
                    </div>
                  </label>
                  {paymentMethod === "cod" && bootstrap!.codConfirmationRequired ? (
                    <label className="flex items-start gap-3 rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
                      <input
                        checked={codConfirmationAccepted}
                        className="mt-0.5 size-4 accent-gold"
                        disabled={Boolean(session)}
                        onChange={(event) => setCodConfirmationAccepted(event.target.checked)}
                        type="checkbox"
                      />
                      <span>I confirm that I will pay the total on delivery.</span>
                    </label>
                  ) : null}
                </>
              ) : null}
            </fieldset>

            {/* WhatsApp Help */}
            <div className="mt-5 flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-charcoal">
              <span className="flex items-center gap-2">
                <MessageCircle aria-hidden="true" className="size-4 text-success shrink-0" />
                Need help? Chat with us.
              </span>
              <a
                href={`https://wa.me/916289332132?text=${encodeURIComponent("Hi, I need assistance with my order on THREAD.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-success underline hover:text-success/80 ml-2"
              >
                WhatsApp
              </a>
            </div>
          </section>

          {/* Policy Accept */}
          {!session ? (
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
                and order-cancellation policies.
              </span>
            </label>
          ) : null}

          {error ? (
            <p className="rounded-md bg-error/5 p-4 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}

          {/* Place Order Button */}
          {!session ? (
            <Button
              className="w-full gap-2 font-semibold shadow-sm"
              disabled={busy || bootstrap!.shippingMethods.length === 0}
              onClick={() => void createCheckout()}
              size="lg"
              variant="gold"
            >
              <ShieldCheck aria-hidden="true" className="size-5" />
              {busy ? (
                "Processing your order…"
              ) : paymentMethod === "cod" ? (
                <>
                  Place COD Order
                  {estimatedTotal > 0 && (
                    <span className="ml-1 font-normal opacity-80">
                      — Pay <Price amount={estimatedTotal} className="inline text-base font-bold" />
                    </span>
                  )}
                </>
              ) : (
                <>
                  Proceed to Pay
                  {estimatedTotal > 0 && (
                    <span className="ml-1 font-normal opacity-80">
                      — <Price amount={estimatedTotal} className="inline text-base font-bold" />
                    </span>
                  )}
                </>
              )}
            </Button>
          ) : null}
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
      {!session ? (
        <div className="fixed inset-x-0 bottom-16 z-header flex items-center justify-between gap-3 border-t bg-paper p-3 shadow-raised lg:hidden">
          <div>
            <p className="text-xs text-muted">
              Total (incl. delivery + {paymentMethod === "cod" ? "5%" : "3%"} tax)
            </p>
            <Price
              amount={estimatedTotal}
            />
          </div>
          <Button
            className="font-semibold"
            disabled={busy || bootstrap!.shippingMethods.length === 0}
            onClick={() => void createCheckout()}
            variant="gold"
          >
            {busy ? "Processing…" : paymentMethod === "cod" ? "Place COD Order" : "Proceed to Pay"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
