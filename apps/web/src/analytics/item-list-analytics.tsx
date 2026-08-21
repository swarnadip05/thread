"use client";

import { useEffect } from "react";
import type { ProductSummaryDto } from "@thread/types";
import { useAnalytics } from "./analytics-provider";

export function ItemListAnalytics({
  items,
  listName,
}: {
  readonly items: readonly ProductSummaryDto[];
  readonly listName: string;
}) {
  const { track } = useAnalytics();
  useEffect(() => {
    track("view_item_list", {
      item_list_name: listName,
      item_count: items.length,
      item_ids: items.map((item) => item.id),
    });
  }, [items, listName, track]);
  return null;
}
