"use client";

import type { AdminCustomerDto, AdminOrderSummaryDto } from "@thread/types";
import { Badge, ErrorState, Price, Skeleton } from "@thread/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

export function CustomerDetailAdmin({ customerId }: { readonly customerId: string }) {
  const auth = useAuth();
  const [data, setData] = useState<{
    customer: AdminCustomerDto;
    orders: readonly AdminOrderSummaryDto[];
  } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setData(await apiRequest(`/admin/operations/customers/${customerId}`, auth.accessToken));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Customer could not be loaded.");
    }
  }, [auth.accessToken, customerId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  if (error)
    return <ErrorState className="text-ink" description={error} title="Customer unavailable" />;
  if (!data) return <Skeleton className="h-80 w-full" />;
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">
        Audited customer profile
      </p>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-3xl font-semibold">{data.customer.name}</h1>
        <Badge>{data.customer.status}</Badge>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg bg-paper p-5 text-ink">
          <h2 className="font-semibold">Restricted contact details</h2>
          <p className="mt-4 text-sm">{data.customer.email ?? "No email"}</p>
          <p className="mt-1 text-sm">{data.customer.phone ?? "No phone"}</p>
          <p className="mt-5 text-sm text-muted">
            {data.customer.orderCount} orders · <Price amount={data.customer.lifetimeValuePaise} />
          </p>
        </aside>
        <section className="rounded-lg bg-paper p-5 text-ink">
          <h2 className="font-semibold">Order history</h2>
          <div className="mt-4 divide-y divide-ink/10">
            {data.orders.map((order) => (
              <Link
                className="flex items-center justify-between gap-4 py-4"
                href={`/admin/orders/${order.id}`}
                key={order.id}
              >
                <span>
                  <span className="font-semibold">{order.orderNumber}</span>
                  <span className="block text-xs text-muted">
                    {order.status.replaceAll("_", " ")}
                  </span>
                </span>
                <Price amount={order.totalPaise} />
              </Link>
            ))}
            {data.orders.length === 0 ? (
              <p className="py-5 text-sm text-muted">No orders are associated with this account.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
