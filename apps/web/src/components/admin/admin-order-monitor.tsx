"use client";

import type {
  InventoryUpdatedEvent,
  OrderCreatedEvent,
  OrderStatus,
  OrderTrackingDto,
} from "@thread/types";
import { Badge, Button, EmptyState, Input, Select, useToast } from "@thread/ui";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { fallbackPollingInterval } from "@/realtime/polling";
import { useRealtime } from "@/realtime/realtime-provider";

const statusOptions = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
].map((value) => ({ value, label: value.replaceAll("_", " ") }));

export function AdminOrderMonitor() {
  const auth = useAuth();
  const realtime = useRealtime();
  const { toast } = useToast();
  const [orders, setOrders] = useState<readonly OrderTrackingDto[]>([]);
  const [trackingDrafts, setTrackingDrafts] = useState<
    Readonly<Record<string, { number: string; url: string }>>
  >({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setOrders(await apiRequest<readonly OrderTrackingDto[]>("/orders/admin", auth.accessToken));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Order list is unavailable.");
    }
  }, [auth.accessToken]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(
      () => void load(),
      fallbackPollingInterval(realtime.connected),
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, realtime.connected]);

  useEffect(() => {
    const socket = realtime.socket;
    if (!socket) return;
    const created = (event: OrderCreatedEvent) => {
      toast({
        title: "New order",
        description: event.orderNumber,
        variant: "success",
      });
      void load();
    };
    const updated = () => void load();
    const inventory = (event: InventoryUpdatedEvent) => {
      if (event.lowStock)
        toast({
          title: "Low stock",
          description: `${event.sku}: ${event.availableStock} available`,
        });
    };
    const dashboard = () => void load();
    socket.on("order.created", created);
    socket.on("order.status.updated", updated);
    socket.on("inventory.updated", inventory);
    socket.on("admin.dashboard.updated", dashboard);
    return () => {
      socket.off("order.created", created);
      socket.off("order.status.updated", updated);
      socket.off("inventory.updated", inventory);
      socket.off("admin.dashboard.updated", dashboard);
    };
  }, [load, realtime.socket, toast]);

  const update = async (orderId: string, status: OrderStatus) => {
    if (!auth.accessToken) return;
    const draft = trackingDrafts[orderId] ?? { number: "", url: "" };
    setBusyId(orderId);
    try {
      await apiRequest(`/orders/admin/${orderId}/status`, auth.accessToken, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(draft.number.trim() ? { trackingNumber: draft.number.trim() } : {}),
          ...(draft.url.trim() ? { trackingUrl: draft.url.trim() } : {}),
        }),
      });
      setTrackingDrafts((current) => ({ ...current, [orderId]: { number: "", url: "" } }));
      await load();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Order update failed.";
      setError(message);
      toast({ title: "Order update failed", description: message, variant: "error" });
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-paper/10 bg-paper/5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Operations</p>
          <h2 className="mt-2 text-2xl font-semibold">Live orders</h2>
        </div>
        <Badge className="ml-auto" variant={realtime.connected ? "success" : "neutral"}>
          {realtime.connected ? "Live" : "Polling fallback"}
        </Badge>
      </div>
      {orders.length ? (
        <ul className="mt-5 grid gap-4">
          {orders.map((order) => (
            <li className="rounded-md border border-paper/10 bg-charcoal p-4" key={order.id}>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-sm">{order.orderNumber}</p>
                <Badge className="capitalize">{order.status.replaceAll("_", " ")}</Badge>
                <Select
                  ariaLabel={`Update ${order.orderNumber} status`}
                  onValueChange={(value) => void update(order.id, value as OrderStatus)}
                  options={statusOptions}
                  placeholder={order.status.replaceAll("_", " ")}
                  {...(statusOptions.some((option) => option.value === order.status)
                    ? { value: order.status }
                    : {})}
                />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Input
                  aria-label="Tracking number for next update"
                  onChange={(event) =>
                    setTrackingDrafts((current) => ({
                      ...current,
                      [order.id]: {
                        number: event.target.value,
                        url: current[order.id]?.url ?? "",
                      },
                    }))
                  }
                  placeholder="Tracking number (optional)"
                  value={trackingDrafts[order.id]?.number ?? ""}
                />
                <Input
                  aria-label="HTTPS tracking link for next update"
                  onChange={(event) =>
                    setTrackingDrafts((current) => ({
                      ...current,
                      [order.id]: {
                        number: current[order.id]?.number ?? "",
                        url: event.target.value,
                      },
                    }))
                  }
                  placeholder="https://courier.example/..."
                  type="url"
                  value={trackingDrafts[order.id]?.url ?? ""}
                />
              </div>
              {busyId === order.id ? (
                <p aria-live="polite" className="mt-2 text-xs text-paper/60">
                  Updating…
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-5 border-paper/20 bg-charcoal text-paper"
          description="New confirmed orders will appear here."
          title="No orders"
        />
      )}
      <Button className="mt-5" onClick={() => void load()} variant="outline">
        Refresh orders
      </Button>
      {error ? (
        <p aria-live="polite" className="mt-3 text-sm text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
