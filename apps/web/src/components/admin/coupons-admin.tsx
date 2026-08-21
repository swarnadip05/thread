"use client";

import type { CheckoutAdminDto, CouponAdminDto } from "@thread/types";
import { Badge, Button, EmptyState, ErrorState, Input, Skeleton } from "@thread/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export function CouponsAdmin() {
  const auth = useAuth();
  const [coupons, setCoupons] = useState<readonly CouponAdminDto[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const configuration = await apiRequest<CheckoutAdminDto>(
        "/checkout/admin/configuration",
        auth.accessToken,
      );
      setCoupons(configuration.coupons);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Coupons could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.accessToken) return;
    const data = new FormData(event.currentTarget);
    const percentage = data.get("discountType") === "percentage";
    await apiRequest("/checkout/admin/coupons", auth.accessToken, {
      method: "POST",
      body: JSON.stringify({
        code: data.get("code"),
        description: data.get("description"),
        discountType: percentage ? "percentage" : "fixed",
        valuePaise: percentage ? null : Number(data.get("value")),
        valueBps: percentage ? Number(data.get("value")) : null,
        minimumSubtotalPaise: Number(data.get("minimumSubtotalPaise")),
        maximumDiscountPaise: null,
        startsAt: new Date(String(data.get("startsAt"))).toISOString(),
        endsAt: new Date(String(data.get("endsAt"))).toISOString(),
        usageLimit: null,
        perUserLimit: Number(data.get("perUserLimit")),
        categoryIds: [],
        productIds: [],
        active: true,
      }),
    });
    event.currentTarget.reset();
    await load();
  };
  if (loading) return <Skeleton className="h-80 w-full" />;
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">Promotions</p>
      <h1 className="mt-2 text-3xl font-semibold">Coupons</h1>
      <p className="mt-2 text-sm text-paper/65">
        Discounts are recalculated on the server and clamped so totals cannot become negative.
      </p>
      {error ? (
        <ErrorState className="mt-6 text-ink" description={error} title="Coupons unavailable" />
      ) : null}
      <form
        className="mt-7 grid gap-4 rounded-lg bg-paper p-6 text-ink md:grid-cols-3"
        onSubmit={create}
      >
        <Input name="code" placeholder="Code" required />
        <Input name="description" placeholder="Description" />
        <select className="min-h-11 rounded-md border px-3" name="discountType">
          <option value="fixed">Fixed paise</option>
          <option value="percentage">Percentage basis points</option>
        </select>
        <Input min="1" name="value" placeholder="Value" required type="number" />
        <Input
          min="0"
          name="minimumSubtotalPaise"
          placeholder="Minimum spend (paise)"
          required
          type="number"
        />
        <Input min="1" name="perUserLimit" placeholder="Per-user limit" required type="number" />
        <label className="grid gap-1 text-sm">
          Starts at
          <Input name="startsAt" required type="datetime-local" />
        </label>
        <label className="grid gap-1 text-sm">
          Ends at
          <Input name="endsAt" required type="datetime-local" />
        </label>
        <Button className="self-end" type="submit">
          Create coupon
        </Button>
      </form>
      {coupons.length === 0 ? (
        <EmptyState
          className="mt-6 text-ink"
          description="Create the first controlled offer above."
          title="No coupons"
        />
      ) : (
        <div className="mt-6 grid gap-3">
          {coupons.map((coupon) => (
            <article
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-paper p-5 text-ink"
              key={coupon.id}
            >
              <div>
                <p className="font-semibold">{coupon.code}</p>
                <p className="text-sm text-muted">
                  {coupon.description || "No description"} · Used {coupon.redeemedCount}
                  {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                </p>
              </div>
              <Badge variant={coupon.active ? "success" : "neutral"}>
                {coupon.active ? "Active" : "Inactive"}
              </Badge>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
