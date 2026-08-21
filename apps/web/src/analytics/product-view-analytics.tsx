"use client";

import { useEffect } from "react";
import type { ProductDetailDto } from "@thread/types";
import { useAnalytics } from "./analytics-provider";

export function ProductViewAnalytics({ product }: { readonly product: ProductDetailDto }) {
  const { track } = useAnalytics();
  useEffect(() => {
    track("view_item", {
      item_id: product.id,
      item_name: product.title,
      value_paise: product.minSalePricePaise,
    });
  }, [product, track]);
  return null;
}
