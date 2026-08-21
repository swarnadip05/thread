"use client";

import { IconButton } from "@thread/ui";
import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

const wishlistKey = "thread:wishlist:v1";
const wishlistEvent = "thread:wishlist-changed";

function readWishlist(): readonly string[] {
  try {
    const value = JSON.parse(localStorage.getItem(wishlistKey) ?? "[]") as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(wishlistEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(wishlistEvent, onStoreChange);
  };
}

export function WishlistToggle({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  const selected = useSyncExternalStore(
    subscribe,
    () => readWishlist().includes(productId),
    () => false,
  );

  function toggle(): void {
    const items = new Set(readWishlist());
    if (items.has(productId)) items.delete(productId);
    else items.add(productId);
    localStorage.setItem(wishlistKey, JSON.stringify([...items]));
    window.dispatchEvent(new Event(wishlistEvent));
  }

  return (
    <IconButton
      aria-label={`${selected ? "Remove" : "Add"} ${productTitle} ${
        selected ? "from" : "to"
      } wishlist`}
      aria-pressed={selected}
      className="bg-paper/95 shadow-subtle hover:bg-paper"
      onClick={toggle}
    >
      <Heart aria-hidden="true" className={selected ? "size-5 fill-gold text-ink" : "size-5"} />
    </IconButton>
  );
}
