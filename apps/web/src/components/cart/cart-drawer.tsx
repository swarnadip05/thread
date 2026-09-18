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
  X,
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

export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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

  // Prevent background scrolling when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalPaise = getCartTotalPaise(items);
  const totalMrpPaise = items.reduce(
    (sum, item) => sum + (item.mrpPaise ?? item.observedUnitPricePaise ?? 0) * item.quantity,
    0,
  );
  const savingsPaise = Math.max(0, totalMrpPaise - subtotalPaise);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-zinc-900" />
            <h2 className="text-lg font-black text-zinc-950">
              Shopping Bag ({totalCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
            aria-label="Close bag"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Free Shipping Banner */}
        <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200 flex items-center gap-2 text-xs font-bold text-amber-950">
          <Truck className="h-4 w-4 text-amber-700 flex-shrink-0" />
          <span>🎉 Free Express Delivery available on this order!</span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-16">
              <div className="rounded-full bg-zinc-100 p-6 mb-4">
                <ShoppingBag className="h-10 w-10 text-zinc-400" />
              </div>
              <h3 className="text-lg font-black text-zinc-900">Your bag is empty</h3>
              <p className="mt-1 max-w-xs text-xs font-medium text-zinc-500">
                Explore our oversized graphic tees and discover your signature fit.
              </p>
              <Link
                href="/men"
                onClick={onClose}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-6 py-2.5 text-xs font-black text-white hover:bg-zinc-800 transition shadow"
              >
                Start Shopping →
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const unitPrice = item.observedUnitPricePaise ?? 0;
              const unitMrp = item.mrpPaise ?? 0;

              return (
                <div
                  key={item.variantId}
                  className="flex gap-3.5 rounded-2xl border-2 border-zinc-100 bg-zinc-50/50 p-3.5 transition hover:border-zinc-300"
                >
                  {/* Thumbnail */}
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-300">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/shop/${item.slug}`}
                          onClick={onClose}
                          className="text-xs font-black text-zinc-950 hover:underline line-clamp-2"
                        >
                          {item.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.variantId)}
                          className="text-zinc-400 hover:text-red-600 transition p-0.5 ml-1"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold text-zinc-600">
                        {item.size && (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-zinc-900">
                            Size: {item.size}
                          </span>
                        )}
                        {item.colour && (
                          <span className="text-zinc-600">
                            {item.colour}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price & Quantity Controls */}
                    <div className="mt-2.5 flex items-center justify-between pt-1">
                      <div className="flex items-baseline gap-1.5">
                        <Price amount={unitPrice * item.quantity} className="text-sm font-black text-zinc-950" />
                        {unitMrp > unitPrice && (
                          <Price
                            amount={unitMrp * item.quantity}
                            className="text-[11px] font-bold text-zinc-400 line-through"
                          />
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center rounded-lg border-2 border-zinc-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}
                          className="px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition rounded-l-md"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3 stroke-[3]" />
                        </button>
                        <span className="min-w-[1.75rem] text-center text-xs font-black text-zinc-950">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}
                          className="px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 transition rounded-r-md"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-zinc-200 bg-white p-5 space-y-3.5 shadow-lg">
            {savingsPaise > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 border border-emerald-200">
                <span>Discount Savings</span>
                <span>You save <Price amount={savingsPaise} /></span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Subtotal</span>
                <p className="text-xs text-zinc-400">Taxes included · Free shipping</p>
              </div>
              <Price amount={subtotalPaise} className="text-2xl font-black text-zinc-950" />
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2 pt-1">
              <Link
                href="/checkout"
                onClick={onClose}
                className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-amber-400 font-black px-6 text-sm shadow-lg transition active:scale-[0.98]"
              >
                Proceed to Buy ({totalCount} {totalCount === 1 ? "Item" : "Items"})
                <ArrowRight className="h-4 w-4 stroke-[3]" />
              </Link>

              <Link
                href="/cart"
                onClick={onClose}
                className="flex w-full items-center justify-center py-2 text-xs font-black text-zinc-700 hover:text-zinc-950 transition underline underline-offset-4"
              >
                View full bag details
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[11px] font-bold text-zinc-500 border-t border-zinc-100">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                100% Secure
              </span>
              <span>•</span>
              <span>UPI / Cards / COD</span>
              <span>•</span>
              <span>Easy Returns</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
