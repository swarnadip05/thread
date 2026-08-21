"use client";

import type { ProductReviewDto, ProductReviewPageDto } from "@thread/types";
import { Button, EmptyState, ErrorState } from "@thread/ui";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export function ReviewModerationPanel() {
  const auth = useAuth();
  const [reviews, setReviews] = useState<readonly ProductReviewDto[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const page = await apiRequest<ProductReviewPageDto>(
        "/catalog/admin/reviews?status=pending&limit=50",
        auth.accessToken,
      );
      setReviews(page.items);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reviews.");
    }
  }, [auth.accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const moderate = async (id: string, status: "approved" | "rejected") => {
    if (!auth.accessToken) return;
    const reason =
      status === "rejected" ? window.prompt("Reason for rejecting this review:") : undefined;
    if (status === "rejected" && !reason) return;
    await apiRequest(`/catalog/admin/reviews/${id}/moderation`, auth.accessToken, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
    });
    setReviews((current) => current.filter((review) => review.id !== id));
  };
  return (
    <section className="shell-container py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Catalogue</p>
      <h1 className="mt-2 text-3xl font-semibold">Review moderation</h1>
      <p className="mt-2 text-sm text-muted">
        Only approved verified-purchase reviews appear publicly.
      </p>
      {error ? (
        <ErrorState
          className="mt-8 text-ink"
          description={error}
          title="Could not load moderation queue"
        />
      ) : null}
      {!error && reviews.length === 0 ? (
        <EmptyState
          className="mt-8 text-ink"
          description="There are no pending reviews."
          title="Queue is clear"
        />
      ) : null}
      <div className="mt-8 grid gap-4">
        {reviews.map((review) => (
          <article
            className="rounded-lg border border-ink/10 bg-paper p-5 text-ink"
            key={review.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{review.title}</p>
                <p className="text-sm text-muted">{review.rating}/5 · Verified purchase</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => void moderate(review.id, "rejected")}
                  size="sm"
                  variant="outline"
                >
                  Reject
                </Button>
                <Button onClick={() => void moderate(review.id, "approved")} size="sm">
                  Approve
                </Button>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6">{review.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
