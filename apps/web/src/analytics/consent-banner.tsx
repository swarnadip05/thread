"use client";

import { Button } from "@thread/ui";
import { useAnalytics } from "./analytics-provider";

export function ConsentBanner() {
  const { consent, setConsent } = useAnalytics();
  if (consent !== "unknown") return null;
  return (
    <aside
      aria-label="Analytics preferences"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] mx-auto max-w-2xl rounded-lg border border-ink/15 bg-paper/98 p-3 shadow-raised backdrop-blur sm:flex sm:items-center sm:gap-4 sm:p-4"
    >
      <p className="text-sm leading-5 text-charcoal">
        We use optional analytics to understand storefront performance. No contact or payment data
        is sent.
      </p>
      <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
        <Button onClick={() => setConsent("rejected")} type="button" variant="outline">
          Decline
        </Button>
        <Button onClick={() => setConsent("accepted")} type="button">
          Accept
        </Button>
      </div>
    </aside>
  );
}
