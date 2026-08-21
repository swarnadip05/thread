"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  noOpAnalytics,
  sanitizeAnalyticsPayload,
  type AnalyticsEventName,
  type AnalyticsPayload,
  type AnalyticsProvider as AnalyticsProviderContract,
} from "./analytics";

type Consent = "accepted" | "rejected" | "unknown";
interface AnalyticsContextValue {
  readonly consent: Consent;
  readonly setConsent: (consent: Exclude<Consent, "unknown">) => void;
  readonly track: (name: AnalyticsEventName, payload: AnalyticsPayload) => void;
}
const AnalyticsContext = createContext<AnalyticsContextValue>({
  consent: "unknown",
  setConsent: () => undefined,
  track: () => undefined,
});

const consentStorageKey = "thread.analytics-consent";
const consentChangeEvent = "thread:analytics-consent";
let memoryConsent: Consent = "unknown";

function consentSnapshot(): Consent {
  try {
    const saved = window.localStorage.getItem(consentStorageKey);
    return saved === "accepted" || saved === "rejected" ? saved : "unknown";
  } catch {
    return memoryConsent;
  }
}

function subscribeToConsent(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(consentChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(consentChangeEvent, onStoreChange);
  };
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function gtagProvider(): AnalyticsProviderContract {
  return {
    track(name, payload) {
      window.gtag?.("event", name, sanitizeAnalyticsPayload(payload));
    },
  };
}

function loadGtag(measurementId: string): void {
  if (document.querySelector(`script[data-thread-analytics="${measurementId}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.threadAnalytics = measurementId;
  document.head.append(script);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
}

export function AnalyticsProvider({ children }: { readonly children: ReactNode }) {
  const consent = useSyncExternalStore<Consent>(
    subscribeToConsent,
    consentSnapshot,
    () => "unknown",
  );
  const provider = useMemo(() => {
    const measurementId = process.env.NEXT_PUBLIC_ANALYTICS_MEASUREMENT_ID;
    return process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "gtag" && measurementId
      ? gtagProvider()
      : noOpAnalytics;
  }, []);
  useEffect(() => {
    if (consent !== "accepted") return;
    const measurementId = process.env.NEXT_PUBLIC_ANALYTICS_MEASUREMENT_ID;
    if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "gtag" && measurementId)
      loadGtag(measurementId);
  }, [consent]);
  useEffect(() => {
    if (consent !== "accepted") return;
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-analytics-event]",
      );
      const name = target?.dataset.analyticsEvent as AnalyticsEventName | undefined;
      if (!target || name !== "select_item") return;
      provider.track(name, {
        item_id: target.dataset.analyticsItemId ?? "",
        item_name: target.dataset.analyticsItemName ?? "",
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [consent, provider]);
  const value = useMemo<AnalyticsContextValue>(
    () => ({
      consent,
      setConsent(next) {
        memoryConsent = next;
        try {
          window.localStorage.setItem(consentStorageKey, next);
        } catch {
          // Retain the in-memory choice when persistent storage is unavailable.
        }
        window.dispatchEvent(new Event(consentChangeEvent));
      },
      track(name, payload) {
        if (consent === "accepted") provider.track(name, payload);
      },
    }),
    [consent, provider],
  );
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}
