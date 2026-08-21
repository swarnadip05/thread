"use client";

import Link from "next/link";
import type { OrderTrackingDto } from "@thread/types";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@thread/ui";
import { Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { fallbackPollingInterval } from "@/realtime/polling";
import { useRealtime } from "@/realtime/realtime-provider";

export function OrderList() {
  const auth = useAuth();
  const realtime = useRealtime();
  const [orders, setOrders] = useState<readonly OrderTrackingDto[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setOrders(await apiRequest<readonly OrderTrackingDto[]>("/orders", auth.accessToken));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Orders are unavailable.");
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
    const refresh = () => void load();
    socket.on("order.created", refresh);
    socket.on("order.status.updated", refresh);
    return () => {
      socket.off("order.created", refresh);
      socket.off("order.status.updated", refresh);
    };
  }, [load, realtime.socket]);

  if (!orders)
    return error ? (
      <ErrorState description={error} title="Orders unavailable" />
    ) : (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  if (!orders.length)
    return (
      <EmptyState
        action={
          <Button asChild>
            <Link href="/men">Start shopping</Link>
          </Button>
        }
        description="Confirmed orders will appear here."
        title="No orders yet"
      />
    );
  return (
    <ul className="grid gap-4">
      {orders.map((order) => (
        <li className="rounded-lg border border-ink/10 bg-paper p-5 shadow-subtle" key={order.id}>
          <div className="flex flex-wrap items-center gap-3">
            <Package aria-hidden="true" className="size-5" />
            <h2 className="font-semibold">{order.orderNumber}</h2>
            <Badge className="capitalize">{order.status.replaceAll("_", " ")}</Badge>
            <time className="ml-auto text-xs text-muted" dateTime={order.updatedAt}>
              Updated {new Date(order.updatedAt).toLocaleString("en-IN")}
            </time>
          </div>
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link href={`/account/orders/${order.id}`}>View tracking</Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
