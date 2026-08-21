"use client";

import Link from "next/link";
import type { AdminDashboardDto, AdminDashboardMetricDto } from "@thread/types";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@thread/ui";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { API_URL, apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { useRealtime } from "@/realtime/realtime-provider";

type RangePreset = "today" | "last_7_days" | "last_30_days" | "custom";

function formatPaise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
    new Date(value),
  );
}

function MetricCard({
  icon: Icon,
  label,
  metric,
  money = false,
}: {
  readonly icon: typeof WalletCards;
  readonly label: string;
  readonly metric: AdminDashboardMetricDto;
  readonly money?: boolean;
}) {
  const improving = (metric.changePercent ?? 0) >= 0;
  return (
    <section className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5 shadow-subtle">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-paper/50">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            {money
              ? formatPaise(metric.value)
              : new Intl.NumberFormat("en-IN").format(metric.value)}
          </p>
        </div>
        <span className="grid size-10 place-items-center rounded-md bg-gold/15 text-gold">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
      {metric.changePercent !== undefined ? (
        <p
          className={`mt-4 flex items-center gap-1 text-xs ${improving ? "text-success" : "text-error"}`}
        >
          {improving ? (
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          ) : (
            <ArrowDownRight aria-hidden="true" className="size-3.5" />
          )}
          {Math.abs(metric.changePercent)}% vs previous period
        </p>
      ) : (
        <p className="mt-4 text-xs text-paper/45">No comparable prior period yet</p>
      )}
    </section>
  );
}

function SalesChart({ sales }: { readonly sales: AdminDashboardDto["sales"] }) {
  const maximum = Math.max(1, ...sales.map((point) => point.revenuePaise));
  if (!sales.length)
    return (
      <EmptyState
        className="border-paper/10 bg-transparent text-paper"
        description="Paid order revenue will appear as soon as orders are captured."
        title="No sales in this period"
      />
    );
  return (
    <div aria-label="Sales chart" className="mt-6 h-52" role="img">
      <div className="flex h-full items-end gap-1.5">
        {sales.map((point) => {
          const height = Math.max(8, Math.round((point.revenuePaise / maximum) * 100));
          return (
            <div className="group relative flex h-full min-w-0 flex-1 items-end" key={point.date}>
              <span
                aria-label={`${formatDate(point.date)}: ${formatPaise(point.revenuePaise)}`}
                className="w-full rounded-t-sm bg-gold/80 transition group-hover:bg-gold"
                style={{ height: `${height}%` }}
              />
              <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-paper px-2 py-1 text-xs text-ink shadow-raised group-hover:block">
                {formatPaise(point.revenuePaise)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-paper/45">
        <span>{formatDate(sales[0]!.date)}</span>
        <span>{formatDate(sales.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-20 w-full bg-paper/10" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-38 bg-paper/10" />
        <Skeleton className="h-38 bg-paper/10" />
        <Skeleton className="h-38 bg-paper/10" />
      </div>
      <Skeleton className="h-96 bg-paper/10" />
    </div>
  );
}

export function AdminDashboard() {
  const { accessToken } = useAuth();
  const realtime = useRealtime();
  const [preset, setPreset] = useState<RangePreset>("last_30_days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [dashboard, setDashboard] = useState<AdminDashboardDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return params.toString();
  }, [customFrom, customTo, preset]);
  const load = useCallback(async () => {
    if (!accessToken) return;
    if (preset === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      setError("Choose both dates for a custom dashboard range.");
      return;
    }
    setLoading(true);
    try {
      setDashboard(await apiRequest<AdminDashboardDto>(`/admin/dashboard?${query}`, accessToken));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, customFrom, customTo, preset, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const socket = realtime.socket;
    if (!socket) return;
    const refresh = () => void load();
    socket.on("admin.dashboard.updated", refresh);
    socket.on("order.created", refresh);
    socket.on("payment.updated", refresh);
    return () => {
      socket.off("admin.dashboard.updated", refresh);
      socket.off("order.created", refresh);
      socket.off("payment.updated", refresh);
    };
  }, [load, realtime.socket]);

  const download = async () => {
    if (!accessToken) return;
    const response = await fetch(`${API_URL}/api/v1/admin/dashboard/export?${query}`, {
      headers: { authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });
    if (!response.ok) {
      setError("Export could not be prepared.");
      return;
    }
    const href = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "thread-dashboard-orders.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Command centre</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Business overview
          </h1>
          <p className="mt-2 max-w-xl text-sm text-paper/60">
            Server-calculated order, payment and inventory signals for THREAD operations.
          </p>
          <p className="mt-1 text-xs text-paper/45">
            Source: server-confirmed order and payment records · Range:{" "}
            {preset === "custom"
              ? `${customFrom || "—"} to ${customTo || "—"}`
              : preset.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "last_7_days", "last_30_days"] as const).map((option) => (
            <Button
              key={option}
              onClick={() => setPreset(option)}
              size="sm"
              variant={preset === option ? "primary" : "outline"}
            >
              {option === "today" ? "Today" : option === "last_7_days" ? "7 days" : "30 days"}
            </Button>
          ))}
          <Button
            onClick={() => setPreset("custom")}
            size="sm"
            variant={preset === "custom" ? "primary" : "outline"}
          >
            <CalendarDays aria-hidden="true" className="size-4" /> Custom
          </Button>
          <Button
            aria-label="Refresh dashboard"
            onClick={() => void load()}
            size="sm"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <Button onClick={() => void download()} size="sm" variant="outline">
            <Download aria-hidden="true" className="size-4" /> Export
          </Button>
        </div>
      </section>
      {preset === "custom" ? (
        <section className="flex flex-wrap gap-3 rounded-lg border border-paper/10 bg-paper/[0.045] p-4">
          <label className="grid gap-1 text-sm text-paper/70">
            From
            <input
              className="min-h-10 rounded-md border border-paper/15 bg-charcoal px-3 text-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
              onChange={(event) => setCustomFrom(event.target.value)}
              type="date"
              value={customFrom}
            />
          </label>
          <label className="grid gap-1 text-sm text-paper/70">
            To
            <input
              className="min-h-10 rounded-md border border-paper/15 bg-charcoal px-3 text-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
              onChange={(event) => setCustomTo(event.target.value)}
              type="date"
              value={customTo}
            />
          </label>
        </section>
      ) : null}
      {loading && !dashboard ? <DashboardLoading /> : null}
      {error && !dashboard ? (
        <ErrorState description={error} title="Dashboard unavailable" />
      ) : null}
      {dashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard icon={WalletCards} label="Revenue" metric={dashboard.revenue} money />
            <MetricCard icon={ShoppingBag} label="Paid orders" metric={dashboard.paidOrders} />
            <MetricCard
              icon={TrendingUp}
              label="Average order value"
              metric={dashboard.averageOrderValue}
              money
            />
          </section>
          {dashboard.conversion ? (
            <MetricCard icon={Users} label="Conversion" metric={dashboard.conversion} />
          ) : null}
          <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
            <article className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Paid sales</h2>
                  <p className="mt-1 text-sm text-paper/55">Captured payments by order date</p>
                </div>
                <Badge variant="neutral">{dashboard.sales.length} days</Badge>
              </div>
              <SalesChart sales={dashboard.sales} />
            </article>
            <article className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5 md:p-6">
              <h2 className="font-semibold">Operations queue</h2>
              <dl className="mt-5 grid gap-4">
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-paper/60">Pending orders</dt>
                  <dd className="font-mono text-xl">{dashboard.pendingOrders}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-paper/60">Return requests</dt>
                  <dd className="font-mono text-xl">{dashboard.returnRequests}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-paper/60">New customers</dt>
                  <dd className="font-mono text-xl">{dashboard.newCustomers}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-paper/60">Low-stock variants</dt>
                  <dd className="font-mono text-xl text-gold">
                    {dashboard.lowStockVariants.length}
                  </dd>
                </div>
              </dl>
            </article>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="overflow-hidden rounded-lg border border-paper/10 bg-paper/[0.045]">
              <div className="flex items-center justify-between border-b border-paper/10 p-5">
                <div>
                  <h2 className="font-semibold">Recent orders</h2>
                  <p className="mt-1 text-sm text-paper/55">Non-sensitive operational snapshot</p>
                </div>
                <Link
                  className="text-sm font-medium text-gold hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
                  href="/admin/orders"
                >
                  View all
                </Link>
              </div>
              {dashboard.recentOrders.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-paper/[0.035] text-xs uppercase tracking-[0.1em] text-paper/45">
                      <tr>
                        <th className="px-5 py-3 font-medium">Order</th>
                        <th className="px-5 py-3 font-medium">Payment</th>
                        <th className="px-5 py-3 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentOrders.map((order) => (
                        <tr className="border-t border-paper/10" key={order.id}>
                          <td className="px-5 py-3">
                            <p className="font-mono text-xs">{order.orderNumber}</p>
                            <p className="mt-1 text-xs text-paper/50">
                              {formatDate(order.createdAt)} · {order.itemCount} items
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant={order.paymentStatus === "captured" ? "success" : "neutral"}
                            >
                              {order.paymentStatus.replaceAll("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right font-medium">
                            {formatPaise(order.totalPaise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  className="m-5 border-paper/10 bg-transparent text-paper"
                  description="Paid and pending orders will appear here."
                  title="No orders in this period"
                />
              )}
            </article>
            <article className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5">
              <h2 className="font-semibold">Payment status</h2>
              <p className="mt-1 text-sm text-paper/55">
                Provider status counts for the selected period
              </p>
              {dashboard.paymentStatusBreakdown.length ? (
                <ul className="mt-5 grid gap-3">
                  {dashboard.paymentStatusBreakdown.map((item) => (
                    <li
                      className="flex items-center justify-between rounded-md bg-paper/[0.035] px-3 py-2.5"
                      key={item.status}
                    >
                      <span className="capitalize text-paper/75">
                        {item.status.replaceAll("_", " ")}
                      </span>
                      <span className="font-mono">{item.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="mt-5 border-paper/10 bg-transparent text-paper"
                  description="Payment provider activity will appear once checkout is live."
                  title="No payment activity"
                />
              )}
            </article>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5">
              <div className="flex items-center gap-2">
                <PackageSearch aria-hidden="true" className="size-5 text-gold" />
                <h2 className="font-semibold">Low stock</h2>
              </div>
              {dashboard.lowStockVariants.length ? (
                <ul className="mt-5 grid gap-3">
                  {dashboard.lowStockVariants.map((variant) => (
                    <li
                      className="flex items-center justify-between gap-4 rounded-md bg-paper/[0.035] px-3 py-2.5"
                      key={variant.variantId}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{variant.productTitle}</p>
                        <p className="mt-1 font-mono text-xs text-paper/50">{variant.sku}</p>
                      </div>
                      <p className="shrink-0 text-sm text-gold">
                        {variant.availableStock} / {variant.reorderLevel}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="mt-5 border-paper/10 bg-transparent text-paper"
                  description="Variants at or below their reorder level appear here."
                  title="Stock is healthy"
                />
              )}
            </article>
            <article className="rounded-lg border border-paper/10 bg-paper/[0.045] p-5">
              <h2 className="font-semibold">Top products</h2>
              <p className="mt-1 text-sm text-paper/55">Captured paid-order revenue</p>
              {dashboard.topProducts.length ? (
                <ol className="mt-5 grid gap-3">
                  {dashboard.topProducts.map((product, index) => (
                    <li
                      className="flex items-center gap-3 rounded-md bg-paper/[0.035] px-3 py-2.5"
                      key={product.productId}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 font-mono text-xs text-gold">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.title}</p>
                        <p className="mt-1 text-xs text-paper/50">{product.unitsSold} units sold</p>
                      </div>
                      <p className="shrink-0 text-sm font-medium">
                        {formatPaise(product.revenuePaise)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  className="mt-5 border-paper/10 bg-transparent text-paper"
                  description="Product performance needs captured orders."
                  title="No product sales yet"
                />
              )}
            </article>
          </section>
          <p className="text-xs text-paper/40">
            Generated {new Date(dashboard.generatedAt).toLocaleString("en-IN")} ·{" "}
            {realtime.connected ? "Live updates connected" : "Polling fallback active"}
          </p>
        </>
      ) : null}
      {error && dashboard ? (
        <p aria-live="polite" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
