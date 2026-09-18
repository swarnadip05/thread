"use client";

import { Price } from "@thread/ui";
import {
  ArrowRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
  getCartTotalPaise,
  readCart,
  removeFromCart,
  type StoredCartLine,
  updateCartQuantity,
} from "@/checkout/cart-storage";

export function CartPageContent() {
  const [items, setItems] = useState<StoredCartLine[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener("thread:cart-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("thread:cart-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalPaise = getCartTotalPaise(items);
  const totalMrpPaise = items.reduce(
    (sum, item) => sum + (item.mrpPaise ?? item.observedUnitPricePaise ?? 0) * item.quantity,
    0,
  );
  const savingsPaise = Math.max(0, totalMrpPaise - subtotalPaise);

  return (
    <div className="shell-container py-8 sm:py-12">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
          Shopping Bag ({totalCount})
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-600">
          Review your items and proceed to secure checkout.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-12 text-center my-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
            <ShoppingBag className="h-8 w-8 text-zinc-400" />
          </div>
          <h2 className="mt-4 text-xl font-black text-zinc-900">Your shopping bag is empty</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
            You haven't added any products to your bag yet. Explore our oversized streetwear collection.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/men"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-black text-white hover:bg-zinc-800 transition shadow"
            >
              Shop Men's Oversized →
            </Link>
            <Link
              href="/women"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white px-6 py-3 text-sm font-black text-zinc-900 hover:bg-zinc-100 transition"
            >
              Shop Women's Oversized
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          {/* Items Column */}
          <div className="space-y-4">
            {/* Free Delivery Banner */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 flex-shrink-0 font-bold">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-950">Free Express Delivery Unlocked!</p>
                <p className="text-xs font-semibold text-amber-800">
                  Standard doorstep delivery across India is free on your order.
                </p>
              </div>
            </div>

            {/* List */}
            <div className="rounded-2xl border-2 border-zinc-200 bg-white shadow-sm divide-y divide-zinc-200">
              {items.map((item) => {
                const unitPrice = item.observedUnitPricePaise ?? 0;
                const unitMrp = item.mrpPaise ?? 0;

                return (
                  <div
                    key={item.variantId}
                    className="flex flex-col sm:flex-row gap-4 p-5 sm:items-center justify-between"
                  >
                    <div className="flex gap-4 items-center">
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-zinc-200 bg-zinc-100">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-300">
                            <ShoppingBag className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Link
                          href={`/shop/${item.slug}`}
                          className="text-sm font-black text-zinc-950 hover:underline line-clamp-2"
                        >
                          {item.title}
                        </Link>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-600">
                          {item.size && (
                            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-900 border border-zinc-200">
                              Size: {item.size}
                            </span>
                          )}
                          {item.colour && (
                            <span className="text-zinc-600">
                              Color: {item.colour}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 pt-1 sm:hidden">
                          <Price amount={unitPrice * item.quantity} className="text-base font-black text-zinc-950" />
                          {unitMrp > unitPrice && (
                            <Price
                              amount={unitMrp * item.quantity}
                              className="text-xs font-bold text-zinc-400 line-through"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantity and Price for desktop */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0">
                      {/* Stepper */}
                      <div className="flex items-center rounded-xl border-2 border-zinc-300 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                          className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition rounded-l-lg"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-black text-zinc-950">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                          className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition rounded-r-lg"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                      </div>

                      {/* Line Price */}
                      <div className="hidden sm:block text-right min-w-[5rem]">
                        <Price amount={unitPrice * item.quantity} className="text-base font-black text-zinc-950" />
                        {unitMrp > unitPrice && (
                          <Price
                            amount={unitMrp * item.quantity}
                            className="block text-xs font-bold text-zinc-400 line-through"
                          />
                        )}
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.variantId)}
                        className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="Remove from bag"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary Column */}
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50/70 p-6 shadow-sm space-y-4 lg:sticky lg:top-28">
              <h2 className="text-xl font-black text-zinc-950">Order Summary</h2>

              <dl className="space-y-3 text-sm font-semibold text-zinc-700 border-b border-zinc-200 pb-4">
                <div className="flex justify-between">
                  <dt className="text-zinc-600">Total MRP</dt>
                  <dd className="font-bold text-zinc-900">
                    <Price amount={totalMrpPaise > 0 ? totalMrpPaise : subtotalPaise} />
                  </dd>
                </div>

                {savingsPaise > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <dt>Discount on MRP</dt>
                    <dd>- <Price amount={savingsPaise} /></dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-zinc-600">Delivery Fee</dt>
                  <dd className="text-emerald-600 font-black uppercase">Free</dd>
                </div>
              </dl>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <dt className="text-base font-black text-zinc-950">Total Amount</dt>
                  <dd className="text-xs font-medium text-zinc-500">Includes all taxes</dd>
                </div>
                <Price amount={subtotalPaise} className="text-2xl font-black text-zinc-950" />
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  href="/checkout"
                  className="flex w-full min-h-13 items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-400 font-black px-6 text-base shadow-xl transition active:scale-[0.98]"
                >
                  Proceed to Buy ({totalCount} {totalCount === 1 ? "Item" : "Items"})
                  <ArrowRight className="h-5 w-5 stroke-[3]" />
                </Link>

                <Link
                  href="/men"
                  className="flex w-full items-center justify-center py-2.5 text-xs font-black text-zinc-600 hover:text-zinc-950 transition"
                >
                  ← Continue Shopping
                </Link>
              </div>

              <div className="pt-3 border-t border-zinc-200 space-y-2 text-xs font-bold text-zinc-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>100% Verified Secure Checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Doorstep delivery with full live tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <span>UPI, Cards, Net Banking & Cash on Delivery</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
