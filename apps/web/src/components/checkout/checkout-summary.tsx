import type { CheckoutSessionDto } from "@thread/types";
import { Price } from "@thread/ui";

import type { StoredCartLine } from "@/checkout/cart-storage";

export function CheckoutSummary({
  cart,
  gstin,
  session,
}: {
  cart: readonly StoredCartLine[];
  gstin: string;
  session: CheckoutSessionDto | null;
}) {
  const estimate = cart.reduce(
    (sum, line) => sum + (line.observedUnitPricePaise ?? 0) * line.quantity,
    0,
  );
  return (
    <aside className="rounded-lg border border-ink/10 bg-ivory p-5 lg:sticky lg:top-36">
      <h2 className="text-xl font-semibold">Order summary</h2>
      <div className="mt-5 divide-y divide-ink/10">
        {(session?.items ?? cart).map((item) => {
          const isQuoted = "unitPricePaise" in item;
          return (
            <div className="py-4 first:pt-0" key={item.variantId}>
              <div className="flex justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {isQuoted ? `${item.colour}, ${item.size} · ` : ""}Qty {item.quantity}
                  </p>
                </div>
                {isQuoted ? (
                  <Price amount={item.lineSubtotalPaise} className="text-sm" />
                ) : item.observedUnitPricePaise !== undefined ? (
                  <Price amount={item.observedUnitPricePaise * item.quantity} className="text-sm" />
                ) : (
                  <span className="text-xs text-muted">To confirm</span>
                )}
              </div>
              {isQuoted && item.priceChanged ? (
                <p className="mt-2 text-xs font-semibold text-error" role="status">
                  Price updated from the cart value.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <dl className="mt-5 space-y-3 border-t border-ink/15 pt-5 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>
            <Price amount={session?.totals.subtotalPaise ?? estimate} className="text-sm" />
          </dd>
        </div>
        {session ? (
          <>
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd className="text-success">
                −<Price amount={session.totals.discountPaise} className="text-sm" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>
                <Price amount={session.totals.shippingPaise} className="text-sm" />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Configured tax</dt>
              <dd>
                <Price amount={session.totals.taxPaise} className="text-sm" />
              </dd>
            </div>
          </>
        ) : null}
        <div className="flex justify-between border-t border-ink/15 pt-4 text-base font-bold">
          <dt>Total</dt>
          <dd>
            <Price amount={session?.totals.totalPaise ?? estimate} />
          </dd>
        </div>
      </dl>
      {!session ? (
        <p className="mt-4 text-xs leading-5 text-muted">
          Final prices, configured tax, coupon and shipping are recalculated by THREAD before stock
          is reserved.
        </p>
      ) : null}
      <p className="mt-5 border-t border-ink/15 pt-4 text-xs text-muted">GSTIN: {gstin}</p>
    </aside>
  );
}
