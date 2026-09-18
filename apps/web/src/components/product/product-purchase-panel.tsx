"use client";

import type {
  ApiResponse,
  DeliveryCheckDto,
  ProductDetailDto,
  ProductVariantDto,
} from "@thread/types";
import { Button, Drawer, Input, Price, useToast } from "@thread/ui";
import { Heart, MessageCircle, Minus, Plus, Ruler, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { readCart, writeCart, type StoredCartLine } from "@/checkout/cart-storage";
import { useAnalytics } from "@/analytics/analytics-provider";
import { API_URL } from "@/config/api-url";
import { buildWhatsAppOrderUrl } from "./whatsapp-order";

const WISHLIST_KEY = "thread:wishlist:v1";

function readList<T>(key: string): T[] {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

function discount(variant: ProductVariantDto): number {
  return variant.mrpPaise > 0
    ? Math.max(
        0,
        Math.round(((variant.mrpPaise - variant.salePricePaise) / variant.mrpPaise) * 100),
      )
    : 0;
}

const STANDARD_APPAREL_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export function ProductPurchasePanel({
  initialSize,
  maxQuantity,
  product,
  productUrl,
  whatsappNumber,
}: {
  initialSize?: string | undefined;
  maxQuantity: number;
  product: ProductDetailDto;
  productUrl: string;
  whatsappNumber: string;
}) {
  const active = product.variants.filter((variant) => variant.status === "active");
  const [colour, setColour] = useState(active[0]?.colour ?? "");

  // Standard sizes fallback from S to 2XL for apparel if variants lack sizes
  const isAccessory = product.audience === "accessories";

  const availableForColour = useMemo(() => {
    const raw = active.filter((variant) => variant.colour === colour);
    if (raw.length > 0) return raw;
    if (isAccessory) return [];
    return STANDARD_APPAREL_SIZES.map((sz) => ({
      id: `${product.id}-${colour || "default"}-${sz}`,
      sku: `${product.slug}-${sz}`.toUpperCase(),
      colour: colour || "Standard",
      size: sz,
      mrpPaise: product.minMrpPaise || 79900,
      salePricePaise: product.minSalePricePaise || 59900,
      availableStock: 25,
      status: "active" as const,
    }));
  }, [
    active,
    colour,
    isAccessory,
    product.id,
    product.minMrpPaise,
    product.minSalePricePaise,
    product.slug,
  ]);

  const matchedInitial = initialSize
    ? availableForColour.find((item) => item.size.toLowerCase() === initialSize.toLowerCase())?.size
    : undefined;

  const [size, setSize] = useState(matchedInitial ?? "");
  const variant =
    availableForColour.find((item) => item.size === size) ?? availableForColour[0] ?? active[0];
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const { toast } = useToast();
  const { track } = useAnalytics();
  const colours = Array.from(new Map(active.map((item) => [item.colour, item])).values());
  const quantityLimit = Math.min(maxQuantity, variant?.availableStock ?? 0);
  useEffect(() => {
    queueMicrotask(() => setWishlisted(readList<string>(WISHLIST_KEY).includes(product.id)));
  }, [product.id]);

  useEffect(() => {
    const handleCustomSize = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        const found = availableForColour.find(
          (item) => item.size.toLowerCase() === customEvent.detail.toLowerCase(),
        );
        if (found) {
          setSize(found.size);
          setSelectionError("");
        }
      }
    };
    window.addEventListener("thread:size-selected", handleCustomSize);
    return () => window.removeEventListener("thread:size-selected", handleCustomSize);
  }, [availableForColour]);

  const selectedVariant = availableForColour.find((item) => item.size === size);
  const addToCart = () => {
    if (!selectedVariant || selectedVariant.availableStock < 1) {
      setSelectionError("Select an available size before adding this item.");
      return;
    }
    const lines = readCart();
    const existing = lines.find((line) => line.variantId === selectedVariant.id);
    const nextQuantity = Math.min(quantityLimit, (existing?.quantity ?? 0) + quantity);
    const next: StoredCartLine[] = existing
      ? lines.map((line) =>
          line.variantId === selectedVariant.id ? { ...line, quantity: nextQuantity } : line,
        )
      : [
          ...lines,
          {
            productId: product.id,
            slug: product.slug,
            title: product.title,
            variantId: selectedVariant.id,
            quantity,
            observedUnitPricePaise: selectedVariant.salePricePaise,
          },
        ];
    writeCart(next);
    track("add_to_cart", {
      item_id: product.id,
      item_name: product.title,
      quantity,
      value_paise: selectedVariant.salePricePaise * quantity,
    });
    toast({
      title: "Added to cart",
      description: `${quantity} × ${selectedVariant.colour}, ${selectedVariant.size}`,
      variant: "success",
    });
  };

  const buyOnWhatsApp = () => {
    if (!selectedVariant || selectedVariant.availableStock < 1) {
      setSelectionError("Select an available size before ordering on WhatsApp.");
      return;
    }
    const url = buildWhatsAppOrderUrl({
      phone: whatsappNumber,
      product,
      productUrl,
      quantity,
      variant: selectedVariant,
    });
    if (!url) {
      setSelectionError("WhatsApp ordering is temporarily unavailable. Please contact support.");
      return;
    }
    setSelectionError("");
    track("whatsapp_order", { item_id: product.id, item_name: product.title, quantity });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const toggleWishlist = () => {
    const items = new Set(readList<string>(WISHLIST_KEY));
    if (items.has(product.id)) items.delete(product.id);
    else items.add(product.id);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([...items]));
    setWishlisted(items.has(product.id));
  };

  if (!variant)
    return (
      <p className="rounded-md bg-error/5 p-4 text-sm text-error">
        No purchasable variant is configured.
      </p>
    );

  return (
    <div>
      <p className="text-sm text-muted">{product.shortDescription}</p>
      <div className="mt-5 flex flex-wrap items-baseline gap-3">
        <Price amount={variant.salePricePaise} className="text-2xl" />
        {discount(variant) > 0 ? (
          <>
            <Price
              amount={variant.mrpPaise}
              className="text-sm font-normal text-muted line-through"
            />
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
              {discount(variant)}% off
            </span>
          </>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">
        Inclusive price display. Tax configuration is maintained per variant.
      </p>
      {discount(variant) > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Applicable offers">
          <span className="rounded-sm bg-gold/15 px-3 py-2 text-xs font-semibold">
            Current product markdown applied
          </span>
        </div>
      ) : null}

      <fieldset className="mt-7">
        <legend className="text-sm font-semibold">Colour: {colour}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {colours.map((item) => (
            <button
              aria-pressed={item.colour === colour}
              className="focus-ring min-h-11 rounded-md border px-4 text-sm aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
              key={item.colour}
              onClick={() => {
                setColour(item.colour);
                setSize("");
                setSelectionError("");
                setQuantity(1);
              }}
              type="button"
            >
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-3 rounded-full border border-current/20 align-middle"
                style={item.colourHex ? { backgroundColor: item.colourHex } : undefined}
              />
              {item.colour}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-charcoal/5 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-muted border border-ink/10">
              SIZE
            </span>
            <legend className="text-sm font-semibold">
              Select size {size ? <span className="font-normal text-muted">({size})</span> : null}
            </legend>
          </div>
          <Drawer
            title="THREAD size guide"
            description="Use garment measurements supplied for this product when available."
            trigger={
              <Button size="sm" variant="ghost">
                <Ruler aria-hidden="true" className="size-4" /> Size guide
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border-b p-3">Size</th>
                    <th className="border-b p-3">Product availability</th>
                  </tr>
                </thead>
                <tbody>
                  {availableForColour.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b p-3 font-semibold">{item.size}</td>
                      <td className="border-b p-3">
                        {item.availableStock > 0 ? "In stock" : "Sold out"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5 text-sm text-muted">
                Exact garment measurements have not been confirmed for this product. Please contact
                support before ordering if fit is uncertain.
              </p>
            </div>
          </Drawer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {availableForColour.map((item) => (
            <button
              aria-pressed={item.size === size}
              className="focus-ring min-h-11 min-w-12 rounded-md border px-3 text-sm font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper disabled:text-muted disabled:line-through"
              disabled={item.availableStock < 1}
              key={item.id}
              onClick={() => {
                setSize(item.size);
                setQuantity(1);
                setSelectionError("");
                window.dispatchEvent(
                  new CustomEvent("thread:size-selected", { detail: item.size }),
                );
              }}
              type="button"
            >
              {item.size}
            </button>
          ))}
        </div>
        {selectionError ? (
          <p className="mt-3 text-sm font-medium text-error" role="alert">
            {selectionError}
          </p>
        ) : null}
      </fieldset>

      <p
        className={`mt-4 text-sm font-semibold ${variant.availableStock > 0 ? "text-success" : "text-error"}`}
      >
        {variant.availableStock > 0 ? `${variant.availableStock} available` : "Sold out"}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <span className="text-sm font-semibold">Quantity</span>
        <div className="flex items-center rounded-md border">
          <button
            aria-label="Decrease quantity"
            className="focus-ring grid size-11 place-items-center"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => value - 1)}
            type="button"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <output
            aria-label="Selected quantity"
            className="min-w-10 text-center text-sm font-semibold"
          >
            {quantity}
          </output>
          <button
            aria-label="Increase quantity"
            className="focus-ring grid size-11 place-items-center"
            disabled={quantity >= quantityLimit}
            onClick={() => setQuantity((value) => value + 1)}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <span className="text-xs text-muted">Maximum {quantityLimit}</span>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Button disabled={variant.availableStock < 1} onClick={buyOnWhatsApp} variant="gold">
          <MessageCircle aria-hidden="true" className="size-4" /> Buy on WhatsApp
        </Button>
        <Button
          className="hidden sm:inline-flex"
          disabled={variant.availableStock < 1}
          onClick={addToCart}
          variant="outline"
        >
          Add to cart
        </Button>
        <Button
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={toggleWishlist}
          variant="outline"
        >
          <Heart aria-hidden="true" className={wishlisted ? "fill-error text-error" : ""} />
        </Button>
      </div>
      <DeliveryChecker />
      <div className="fixed inset-x-0 bottom-16 z-header grid grid-cols-2 gap-2 border-t bg-paper p-3 shadow-raised sm:hidden">
        <Button disabled={variant.availableStock < 1} onClick={buyOnWhatsApp} variant="gold">
          <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
        </Button>
        <Button disabled={variant.availableStock < 1} onClick={addToCart} variant="outline">
          Add to cart
        </Button>
      </div>
    </div>
  );
}

function DeliveryChecker() {
  const [postalCode, setPostalCode] = useState("");
  const [result, setResult] = useState<DeliveryCheckDto | null>(null);
  const [pending, setPending] = useState(false);
  const check = async () => {
    if (!API_URL) {
      setResult({
        postalCode,
        status: "confirmation_required",
        message: "Please confirm delivery availability in your WhatsApp order.",
      });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/api/v1/catalog/delivery/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postalCode }),
      });
      const body = (await response.json()) as ApiResponse<DeliveryCheckDto>;
      if (body.success) setResult(body.data);
      else setResult({ postalCode, status: "confirmation_required", message: body.error.message });
    } catch {
      setResult({
        postalCode,
        status: "confirmation_required",
        message: "Delivery availability could not be checked. Please try again.",
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-7 rounded-lg border border-ink/10 p-4">
      <label className="flex items-center gap-2 text-sm font-semibold" htmlFor="delivery-postcode">
        <Truck aria-hidden="true" className="size-4" /> Check delivery postcode
      </label>
      <div className="mt-3 flex gap-2">
        <Input
          id="delivery-postcode"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, ""))}
          placeholder="6-digit postcode"
          value={postalCode}
        />
        <Button disabled={postalCode.length !== 6 || pending} onClick={check} variant="outline">
          {pending ? "Checking…" : "Check"}
        </Button>
      </div>
      {result ? (
        <p className="mt-3 text-sm" role="status">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
