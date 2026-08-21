"use client";

import { useEffect } from "react";
import { useAnalytics } from "@/analytics/analytics-provider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function SearchAnalytics({ query, resultCount }: { query: string; resultCount: number }) {
  const { consent, track } = useAnalytics();
  useEffect(() => {
    if (!query.trim() || consent !== "accepted") return;
    track("search", { search_term: query, result_count: resultCount, query_length: query.length });
    const controller = new AbortController();
    void fetch(`${apiUrl}/api/v1/catalog/search/events`, {
      body: JSON.stringify({ query, resultCount }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [consent, query, resultCount, track]);
  return null;
}
