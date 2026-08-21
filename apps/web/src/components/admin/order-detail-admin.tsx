"use client";

import type { AdminOrderDetailDto, OrderStatus } from "@thread/types";
import { Badge, Button, ErrorState, Input, Price, Skeleton } from "@thread/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest, downloadApiFile } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

const nextStatuses: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["payment_failed", "confirmed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned"],
  returned: ["refunded"],
};

export function OrderDetailAdmin({ orderId }: { readonly orderId: string }) {
  const auth = useAuth();
  const [order, setOrder] = useState<AdminOrderDetailDto | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setOrder(
        await apiRequest<AdminOrderDetailDto>(
          `/admin/operations/orders/${orderId}`,
          auth.accessToken,
        ),
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Order could not be loaded.");
    }
  }, [auth.accessToken, orderId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const transition = async (status: OrderStatus) => {
    if (!auth.accessToken) return;
    const reason = window.prompt(`Reason for moving the order to ${status}:`);
    if (!reason) return;
    await apiRequest(`/admin/operations/orders/${orderId}/status`, auth.accessToken, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    await load();
  };
  const saveTracking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.accessToken) return;
    const data = new FormData(event.currentTarget);
    await apiRequest(`/admin/operations/orders/${orderId}/tracking`, auth.accessToken, {
      method: "PATCH",
      body: JSON.stringify({
        carrier: data.get("carrier"),
        trackingNumber: data.get("trackingNumber"),
        trackingUrl: data.get("trackingUrl") || undefined,
      }),
    });
    await load();
  };
  const download = async (kind: "invoice" | "packing-slip") => {
    if (!auth.accessToken) return;
    const blob = await downloadApiFile(
      `/admin/operations/orders/${orderId}/${kind}`,
      auth.accessToken,
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thread-${kind}-${order?.orderNumber ?? orderId}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (error)
    return <ErrorState className="text-ink" description={error} title="Order unavailable" />;
  if (!order) return <Skeleton className="h-96 w-full" />;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">Order detail</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{order.orderNumber}</h1>
        <Badge>{order.status.replaceAll("_", " ")}</Badge>
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="rounded-lg bg-paper p-6 text-ink">
            <h2 className="text-lg font-semibold">Immutable item snapshots</h2>
            <div className="mt-4 divide-y divide-ink/10">
              {order.items.map((item) => (
                <div className="flex justify-between gap-4 py-4" key={item.variantId}>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted">
                      {item.sku} · {item.colour} · {item.size} · Qty {item.quantity}
                    </p>
                  </div>
                  <Price amount={item.lineSubtotalPaise + item.taxPaise} />
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg bg-paper p-6 text-ink">
            <h2 className="text-lg font-semibold">Timeline & internal notes</h2>
            <ol className="mt-4 space-y-3">
              {order.timeline.map((entry) => (
                <li
                  className="border-l-2 border-gold pl-4 text-sm"
                  key={`${entry.status}-${entry.at}`}
                >
                  <span className="font-semibold">{entry.status.replaceAll("_", " ")}</span>
                  <span className="ml-2 text-muted">{new Date(entry.at).toLocaleString()}</span>
                  {entry.note ? <p className="text-muted">{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-lg bg-paper p-5 text-ink">
            <h2 className="font-semibold">Customer & delivery</h2>
            <p className="mt-3 text-sm">{order.address.fullName}</p>
            <p className="text-sm text-muted">{order.address.addressLine1}</p>
            <p className="text-sm text-muted">
              {order.address.city}, {order.address.state} {order.address.postalCode}
            </p>
            <p className="mt-2 text-sm">{order.customerEmail ?? order.customerPhone}</p>
          </section>
          <section className="rounded-lg bg-paper p-5 text-ink">
            <h2 className="font-semibold">Allowed next actions</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(nextStatuses[order.status] ?? []).map((status) => (
                <Button key={status} onClick={() => void transition(status)} size="sm">
                  {status.replaceAll("_", " ")}
                </Button>
              ))}
            </div>
          </section>
          <form className="rounded-lg bg-paper p-5 text-ink" onSubmit={saveTracking}>
            <h2 className="font-semibold">Tracking</h2>
            <div className="mt-4 space-y-3">
              <Input
                defaultValue={order.trackingCarrier}
                name="carrier"
                placeholder="Carrier"
                required
              />
              <Input
                defaultValue={order.trackingNumber}
                name="trackingNumber"
                placeholder="Tracking number"
                required
              />
              <Input
                defaultValue={order.trackingUrl}
                name="trackingUrl"
                placeholder="HTTPS tracking link"
                type="url"
              />
              <Button className="w-full" size="sm" type="submit">
                Save tracking
              </Button>
            </div>
          </form>
          <section className="rounded-lg bg-paper p-5 text-ink">
            <h2 className="font-semibold">Documents</h2>
            <div className="mt-3 flex gap-4 text-sm font-semibold underline">
              <button onClick={() => void download("packing-slip")} type="button">
                Packing slip
              </button>
              <button onClick={() => void download("invoice")} type="button">
                GST invoice
              </button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Invoice tax values come only from the stored order snapshot.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
