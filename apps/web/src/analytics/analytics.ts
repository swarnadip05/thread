"use client";

export type AnalyticsEventName =
  | "view_item_list"
  | "select_item"
  | "view_item"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "add_payment_info"
  | "purchase"
  | "search";

export type AnalyticsValue = string | number | boolean;
export type AnalyticsPayload = Readonly<Record<string, AnalyticsValue | readonly AnalyticsValue[]>>;

function looksLikePersonalData(value: string): boolean {
  return /@|\+?\d[\d\s()-]{6,}|\b\d{6}\b/.test(value);
}

export function sanitizeAnalyticsPayload(payload: AnalyticsPayload): AnalyticsPayload {
  const safe: Record<string, AnalyticsValue | readonly AnalyticsValue[]> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/email|phone|address|password|token|signature|secret/i.test(key)) continue;
    if (typeof value === "string" && looksLikePersonalData(value)) continue;
    safe[key] = typeof value === "string" ? value.slice(0, 120) : value;
  }
  return safe;
}

export interface AnalyticsProvider {
  track(name: AnalyticsEventName, payload: AnalyticsPayload): void;
}

export const noOpAnalytics: AnalyticsProvider = { track: () => undefined };
