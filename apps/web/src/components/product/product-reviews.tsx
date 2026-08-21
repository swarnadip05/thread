"use client";

import Link from "next/link";
import type { ProductReviewPageDto } from "@thread/types";
import { Button, Input, useToast } from "@thread/ui";
import { Star } from "lucide-react";
import { useState, type FormEvent } from "react";

import { apiRequest } from "../../auth/auth-client";
import { useAuth } from "../../auth/auth-provider";

export function ProductReviews({
  initialReviews,
  productId,
  productSlug,
}: {
  initialReviews: ProductReviewPageDto;
  productId: string;
  productSlug: string;
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const filter = async (rating?: number, page = 1) => {
    setRatingFilter(rating);
    const query = new URLSearchParams({ limit: "10", page: String(page) });
    if (rating) query.set("rating", String(rating));
    const response = await fetch(
      `${apiUrl}/api/v1/catalog/products/${encodeURIComponent(productSlug)}/reviews?${query}`,
    );
    if (!response.ok) return;
    const body = (await response.json()) as { success: boolean; data?: ProductReviewPageDto };
    if (body.success && body.data) setReviews(body.data);
  };

  return (
    <section aria-labelledby="reviews-heading" className="border-t border-ink/10 py-14">
      <div className="grid gap-10 lg:grid-cols-[18rem_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
            Customer feedback
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight" id="reviews-heading">
            Reviews
          </h2>
          <p className="mt-3 text-sm text-muted">
            {initialReviews.total} approved verified-purchase review
            {initialReviews.total === 1 ? "" : "s"}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => void filter()}
              size="sm"
              variant={ratingFilter ? "outline" : "primary"}
            >
              All
            </Button>
            {[5, 4, 3, 2, 1].map((rating) => (
              <Button
                key={rating}
                onClick={() => void filter(rating)}
                size="sm"
                variant={ratingFilter === rating ? "primary" : "outline"}
              >
                {rating} <Star aria-hidden="true" className="size-3 fill-gold text-gold" />
              </Button>
            ))}
          </div>
          <ReviewForm productId={productId} productSlug={productSlug} />
        </div>
        <div>
          {reviews.items.length ? (
            <div className="divide-y divide-ink/10">
              {reviews.items.map((review) => (
                <article className="py-6 first:pt-0" key={review.id}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-1 text-sm font-semibold">
                      {review.rating}{" "}
                      <Star aria-hidden="true" className="size-3 fill-gold text-gold" />
                    </span>
                    <span className="text-xs font-semibold text-success">Verified purchase</span>
                  </div>
                  <h3 className="mt-3 font-semibold">{review.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-charcoal">
                    {review.body}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    {review.userName} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                      new Date(review.createdAt),
                    )}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-ivory p-8 text-sm text-muted">
              No approved reviews match this rating yet.
            </p>
          )}
          {reviews.pages > 1 ? (
            <nav aria-label="Review pages" className="mt-6 flex items-center justify-between">
              <Button
                disabled={reviews.page <= 1}
                onClick={() => void filter(ratingFilter, reviews.page - 1)}
                size="sm"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {reviews.page} of {reviews.pages}
              </span>
              <Button
                disabled={reviews.page >= reviews.pages}
                onClick={() => void filter(ratingFilter, reviews.page + 1)}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      const session = auth.accessToken ? null : await auth.refresh();
      const token = auth.accessToken ?? session?.accessToken;
      if (!token) throw new Error("Please sign in to submit a review.");
      await apiRequest(`/catalog/products/${productId}/reviews`, token, {
        method: "POST",
        body: JSON.stringify({
          orderId: String(data.get("orderId")),
          rating: Number(data.get("rating")),
          title: String(data.get("title")),
          body: String(data.get("body")),
          media: [],
        }),
      });
      event.currentTarget.reset();
      toast({
        title: "Review submitted",
        description: "It will appear after moderation.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Review not submitted",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setPending(false);
    }
  };
  if (auth.status === "anonymous")
    return (
      <Button asChild className="mt-6" variant="outline">
        <Link href={`/auth/login?returnTo=/shop/${productSlug}`}>Sign in to review</Link>
      </Button>
    );
  return (
    <details className="mt-7 rounded-lg border border-ink/10 p-4">
      <summary className="cursor-pointer font-semibold">Write a review</summary>
      <form className="mt-5 grid gap-3" onSubmit={submit}>
        <label className="text-sm font-medium" htmlFor="review-order">
          Delivered order ID
        </label>
        <Input id="review-order" name="orderId" pattern="[a-fA-F0-9]{24}" required />
        <label className="text-sm font-medium" htmlFor="review-rating">
          Rating
        </label>
        <select
          className="min-h-11 rounded-md border px-3"
          defaultValue="5"
          id="review-rating"
          name="rating"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <label className="text-sm font-medium" htmlFor="review-title">
          Title
        </label>
        <Input id="review-title" maxLength={120} minLength={2} name="title" required />
        <label className="text-sm font-medium" htmlFor="review-body">
          Review
        </label>
        <textarea
          className="min-h-28 rounded-md border border-ink/20 p-3 outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
          id="review-body"
          maxLength={5000}
          minLength={10}
          name="body"
          required
        />
        <Button disabled={pending} type="submit">
          {pending ? "Submitting…" : "Submit for moderation"}
        </Button>
      </form>
    </details>
  );
}
