"use client";

import type { OrderStatusUpdatedEvent, OrderTrackingDto } from "@thread/types";
import { Badge, Button, ErrorState, Skeleton } from "@thread/ui";
import { Check, Circle, ExternalLink, FileDown, Radio } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { API_URL, apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { fallbackPollingInterval } from "@/realtime/polling";
import { useRealtime } from "@/realtime/realtime-provider";

export function OrderTracking({ orderId }: { orderId: string }) {
  const auth = useAuth();
  const realtime = useRealtime();
  const [tracking, setTracking] = useState<OrderTrackingDto | null>(null);
  const [error, setError] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setTracking(
        await apiRequest<OrderTrackingDto>(`/orders/${orderId}/tracking`, auth.accessToken),
      );
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Order tracking is unavailable.");
    }
  }, [auth.accessToken, orderId]);

  useEffect(() => {
    realtime.joinOrder(orderId);
  }, [orderId, realtime]);

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
    const updated = (event: OrderStatusUpdatedEvent) => {
      if (event.orderId === orderId) void load();
    };
    socket.on("order.status.updated", updated);
    return () => {
      socket.off("order.status.updated", updated);
    };
  }, [load, orderId, realtime.socket]);

  const downloadInvoice = async () => {
    if (!auth.accessToken) return;
    setInvoiceBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/${orderId}/invoice`, {
        credentials: "include",
        headers: { authorization: `Bearer ${auth.accessToken}` },
      });
      if (!response.ok) throw new Error("Invoice is still being prepared.");
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `${tracking?.orderNumber ?? "thread-order"}-invoice.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      setError("");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Invoice unavailable.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  if (!tracking && !error)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (!tracking) return <ErrorState description={error} title="Order not found" />;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Order tracking</p>
          <h1 className="mt-2 text-3xl font-semibold">{tracking.orderNumber}</h1>
        </div>
        <Badge className="ml-auto capitalize">{tracking.status.replaceAll("_", " ")}</Badge>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Radio
          aria-hidden="true"
          className={`size-4 ${realtime.connected ? "text-success" : "text-muted"}`}
        />
        {realtime.connected ? "Live updates connected" : "Using secure polling fallback"}
      </p>
      <ol className="mt-8 rounded-lg border border-ink/10 bg-paper p-6">
        {tracking.timeline.map((step, index) => (
          <li className="relative flex gap-4 pb-8 last:pb-0" key={step.status}>
            {index < tracking.timeline.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[0.6875rem] top-6 h-[calc(100%-1rem)] w-px ${
                  step.completed ? "bg-success" : "bg-ink/15"
                }`}
              />
            ) : null}
            <span
              className={`relative z-raised grid size-6 shrink-0 place-items-center rounded-full ${
                step.completed ? "bg-success text-paper" : "border border-ink/20 bg-paper"
              }`}
            >
              {step.completed ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <Circle aria-hidden="true" className="size-2" />
              )}
            </span>
            <div>
              <p className="font-semibold capitalize">{step.status.replaceAll("_", " ")}</p>
              {step.completed ? (
                <time className="text-xs text-muted" dateTime={step.at}>
                  {new Date(step.at).toLocaleString("en-IN")}
                </time>
              ) : (
                <p className="text-xs text-muted">Waiting</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        {tracking.trackingUrl ? (
          <Button asChild>
            <a href={tracking.trackingUrl} rel="noopener noreferrer" target="_blank">
              Courier tracking <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </Button>
        ) : null}
        <Button disabled={invoiceBusy} onClick={() => void downloadInvoice()} variant="outline">
          <FileDown aria-hidden="true" className="size-4" />
          {invoiceBusy ? "Preparing…" : "Download invoice"}
        </Button>
      </div>
      {tracking.trackingNumber ? (
        <p className="mt-4 text-sm text-muted">
          Tracking number: <span className="font-mono text-ink">{tracking.trackingNumber}</span>
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="mt-4 text-sm text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
