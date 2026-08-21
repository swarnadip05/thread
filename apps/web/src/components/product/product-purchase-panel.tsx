"use client";

import type {
  ApiResponse,
  DeliveryCheckDto,
  ProductDetailDto,
  ProductVariantDto,
} from "@thread/types";
import { Button, Drawer, Input, Price, useToast } from "@thread/ui";
import { Heart, Minus, Plus, Ruler, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { readCart, writeCart, type StoredCartLine } from "@/checkout/cart-storage";
import { useAnalytics } from "@/analytics/analytics-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
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

export function ProductPurchasePanel({
  maxQuantity,
  product,
}: {
  maxQuantity: number;
  product: ProductDetailDto;
}) {
  const active = product.variants.filter((variant) => variant.status === "active");
  const [colour, setColour] = useState(active[0]?.colour ?? "");
  const availableForColour = active.filter((variant) => variant.colour === colour);
  const [size, setSize] = useState(availableForColour[0]?.size ?? "");
  const variant =
    availableForColour.find((item) => item.size === size) ?? availableForColour[0] ?? active[0];
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { track } = useAnalytics();
  const colours = Array.from(new Map(active.map((item) => [item.colour, item])).values());
  const quantityLimit = Math.min(maxQuantity, variant?.availableStock ?? 0);
  useEffect(() => {
    queueMicrotask(() => setWishlisted(readList<string>(WISHLIST_KEY).includes(product.id)));
  }, [product.id]);

  const addToCart = (buyNow = false) => {
    if (!variant || variant.availableStock < 1) return;
    const lines = readCart();
    const existing = lines.find((line) => line.variantId === variant.id);
    const nextQuantity = Math.min(quantityLimit, (existing?.quantity ?? 0) + quantity);
    const next: StoredCartLine[] = existing
      ? lines.map((line) =>
          line.variantId === variant.id ? { ...line, quantity: nextQuantity } : line,
        )
      : [
          ...lines,
          {
            productId: product.id,
            slug: product.slug,
            title: product.title,
            variantId: variant.id,
            quantity,
            observedUnitPricePaise: variant.salePricePaise,
          },
        ];
    writeCart(next);
    track("add_to_cart", {
      item_id: product.id,
      item_name: product.title,
      quantity,
      value_paise: variant.salePricePaise * quantity,
    });
    toast({
      title: buyNow ? "Ready for checkout" : "Added to cart",
      description: buyNow
        ? "Your selection is saved. Continue to confirm delivery and totals."
        : `${quantity} × ${variant.colour}, ${variant.size}`,
      variant: "success",
    });
    if (buyNow) router.push("/checkout");
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
                setSize(active.find((candidate) => candidate.colour === item.colour)?.size ?? "");
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
          <legend className="text-sm font-semibold">Select size</legend>
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
              aria-pressed={item.size === variant.size}
              className="focus-ring min-h-11 min-w-12 rounded-md border px-3 text-sm font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper disabled:text-muted disabled:line-through"
              disabled={item.availableStock < 1}
              key={item.id}
              onClick={() => {
                setSize(item.size);
                setQuantity(1);
              }}
              type="button"
            >
              {item.size}
            </button>
          ))}
        </div>
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
        <Button disabled={variant.availableStock < 1} onClick={() => addToCart(false)}>
          Add to cart
        </Button>
        <Button
          className="hidden sm:inline-flex"
          disabled={variant.availableStock < 1}
          onClick={() => addToCart(true)}
          variant="gold"
        >
          Buy now
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
        <Button disabled={variant.availableStock < 1} onClick={() => addToCart(false)}>
          Add to cart
        </Button>
        <Button
          disabled={variant.availableStock < 1}
          onClick={() => addToCart(true)}
          variant="gold"
        >
          Buy now
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
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/catalog/delivery/check`, {
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
