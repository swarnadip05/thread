"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

import { API_URL } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

interface ReviewSummary {
  readonly needsReview: boolean;
  readonly pendingCount: number;
}

export function ClientReviewBanner() {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    void fetch(`${API_URL}/api/v1/admin/content/review-summary`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as {
          success: boolean;
          data?: ReviewSummary;
        };
        return body.success ? (body.data ?? null) : null;
      })
      .then((value) => setSummary(value))
      .catch(() => undefined);
    return () => controller.abort();
  }, [accessToken]);

  if (!summary?.needsReview) return null;
  return (
    <aside
      className="mb-8 flex gap-4 rounded-md border border-gold/40 bg-gold/10 p-4 text-paper"
      role="status"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gold" />
      <div>
        <p className="font-semibold">Client review required</p>
        <p className="mt-1 text-sm text-paper/65">
          {summary.pendingCount} content record{summary.pendingCount === 1 ? "" : "s"} contain draft
          legal copy, incomplete size information or another unverified claim.
        </p>
      </div>
    </aside>
  );
}
