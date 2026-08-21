"use client";

import type {
  AdminCustomerDto,
  AdminOrderSummaryDto,
  InventoryAdminRowDto,
  ReturnRequestDto,
} from "@thread/types";
import { Badge, Button, EmptyState, ErrorState, Input, Skeleton } from "@thread/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiRequest, downloadApiFile } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

type Module = "orders" | "returns" | "inventory" | "customers";
interface Page<T> {
  readonly items: readonly T[];
}

const copy: Record<Module, { title: string; description: string }> = {
  orders: {
    title: "Orders",
    description: "Search, fulfil, cancel and refund server-confirmed orders.",
  },
  returns: {
    title: "Returns & exchanges",
    description: "Review requests and progress inspected items through a controlled workflow.",
  },
  inventory: {
    title: "Inventory",
    description:
      "Available stock accounts for active reservations. Adjustments always need a reason.",
  },
  customers: {
    title: "Customers",
    description: "PII access is restricted and every profile view is audited.",
  },
};

function endpoint(module: Module, search: string, filter: string): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (filter) query.set(module === "inventory" ? "lowStock" : "status", filter);
  const suffix = query.size ? `?${query.toString()}` : "";
  return `/admin/operations/${module}${suffix}`;
}

export function OperationsList({ module }: { readonly module: Module }) {
  const auth = useAuth();
  const [items, setItems] = useState<
    readonly (AdminOrderSummaryDto | ReturnRequestDto | InventoryAdminRowDto | AdminCustomerDto)[]
  >([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    setLoading(true);
    try {
      if (module === "returns") {
        setItems(
          await apiRequest<readonly ReturnRequestDto[]>(
            "/admin/operations/returns",
            auth.accessToken,
          ),
        );
      } else {
        const page = await apiRequest<
          Page<AdminOrderSummaryDto | InventoryAdminRowDto | AdminCustomerDto>
        >(endpoint(module, search, filter), auth.accessToken);
        setItems(page.items);
      }
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "The workspace could not load.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, filter, module, search]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    if (!auth.accessToken) return;
    const reason = window.prompt(`Reason for ${decision}:`);
    if (!reason) return;
    await apiRequest(`/admin/operations/returns/${id}/decision`, auth.accessToken, {
      method: "PATCH",
      body: JSON.stringify({ decision, reason }),
    });
    await load();
  };
  const customerStatus = async (customer: AdminCustomerDto) => {
    if (!auth.accessToken) return;
    const status = customer.status === "active" ? "suspended" : "active";
    const reason = window.prompt(`Reason to mark this customer ${status}:`);
    if (!reason) return;
    await apiRequest(`/admin/operations/customers/${customer.id}/status`, auth.accessToken, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    await load();
  };
  const exportInventory = async () => {
    if (!auth.accessToken) return;
    const blob = await downloadApiFile("/admin/operations/inventory/export", auth.accessToken);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "thread-inventory.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const adjustInventory = async (variant: InventoryAdminRowDto) => {
    if (!auth.accessToken) return;
    const quantity = window.prompt(
      `Quantity change for ${variant.sku} (use a negative number to reduce stock):`,
    );
    if (!quantity || !Number.isInteger(Number(quantity)) || Number(quantity) === 0) return;
    const reason = window.prompt("Reason for this manual stock adjustment:");
    if (!reason) return;
    await apiRequest(
      `/catalog/admin/variants/${variant.variantId}/inventory-adjustments`,
      auth.accessToken,
      {
        method: "POST",
        body: JSON.stringify({ quantityDelta: Number(quantity), reason }),
      },
    );
    await load();
  };

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-paper/60">Operations</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{copy[module].title}</h1>
          <p className="mt-2 text-sm text-paper/65">{copy[module].description}</p>
        </div>
        {module === "inventory" ? (
          <button
            className="rounded-md border border-paper/25 px-4 py-2 text-sm font-semibold"
            onClick={() => void exportInventory()}
            type="button"
          >
            Export CSV
          </button>
        ) : null}
      </div>
      {module !== "returns" ? (
        <div className="mt-6 flex max-w-3xl flex-wrap gap-3">
          <Input
            className="min-w-64 flex-1"
            aria-label={`Search ${module}`}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              module === "orders" ? "Order number, email, phone or payment ID" : `Search ${module}`
            }
            value={search}
          />
          <select
            aria-label={`Filter ${module}`}
            className="min-h-11 rounded-md border border-paper/20 bg-charcoal px-3 text-paper"
            onChange={(event) => setFilter(event.target.value)}
            value={filter}
          >
            <option value="">All statuses</option>
            {module === "orders"
              ? [
                  "pending_payment",
                  "confirmed",
                  "processing",
                  "packed",
                  "shipped",
                  "out_for_delivery",
                  "delivered",
                  "cancelled",
                  "returned",
                  "refunded",
                ].map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))
              : null}
            {module === "customers"
              ? ["active", "suspended", "disabled"].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))
              : null}
            {module === "inventory" ? <option value="true">Low stock only</option> : null}
          </select>
        </div>
      ) : null}
      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}
      {error ? (
        <ErrorState className="mt-6 text-ink" description={error} title="Workspace unavailable" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState
          className="mt-6 text-ink"
          description="No records match the current filters."
          title="Nothing to action"
        />
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg bg-paper text-ink">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink/10 bg-ivory text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="p-4">Reference</th>
                <th className="p-4">Details</th>
                <th className="p-4">Status</th>
                <th className="p-4">Value / stock</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {items.map((item) => {
                if ("orderNumber" in item && "customerName" in item)
                  return (
                    <tr key={item.id}>
                      <td className="p-4 font-semibold">{item.orderNumber}</td>
                      <td className="p-4">
                        {item.customerName}
                        <span className="block text-xs text-muted">
                          {item.customerEmail ?? item.customerPhone ?? "No contact"}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge>{item.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="p-4">₹{(item.totalPaise / 100).toFixed(2)}</td>
                      <td className="p-4 text-right">
                        <Link className="font-semibold underline" href={`/admin/orders/${item.id}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                if ("requestNumber" in item)
                  return (
                    <tr key={item.id}>
                      <td className="p-4 font-semibold">{item.requestNumber}</td>
                      <td className="p-4">
                        {item.orderNumber}
                        <span className="block max-w-xs truncate text-xs text-muted">
                          {item.reason}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge>{item.status.replaceAll("_", " ")}</Badge>
                      </td>
                      <td className="p-4">{item.requestType}</td>
                      <td className="p-4 text-right">
                        {item.status === "requested" ? (
                          <span className="flex justify-end gap-2">
                            <Button
                              onClick={() => void decide(item.id, "rejected")}
                              size="sm"
                              variant="outline"
                            >
                              Reject
                            </Button>
                            <Button onClick={() => void decide(item.id, "approved")} size="sm">
                              Approve
                            </Button>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                if ("sku" in item)
                  return (
                    <tr key={item.variantId}>
                      <td className="p-4 font-semibold">{item.sku}</td>
                      <td className="p-4">
                        {item.productTitle}
                        <span className="block text-xs text-muted">
                          {item.colour} / {item.size}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={item.lowStock ? "error" : "success"}>
                          {item.lowStock ? "Low stock" : "Healthy"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {item.availableStock} available
                        <span className="block text-xs text-muted">
                          {item.stockReserved} reserved
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          className="font-semibold underline"
                          onClick={() => void adjustInventory(item)}
                          type="button"
                        >
                          Adjust
                        </button>
                        <span className="ml-3 text-xs text-muted">
                          Reorder at {item.reorderLevel}
                        </span>
                      </td>
                    </tr>
                  );
                return (
                  <tr key={item.id}>
                    <td className="p-4 font-semibold">{item.name}</td>
                    <td className="p-4">
                      {item.email ?? item.phone ?? "No contact"}
                      <span className="block text-xs text-muted">{item.orderCount} orders</span>
                    </td>
                    <td className="p-4">
                      <Badge>{item.status}</Badge>
                    </td>
                    <td className="p-4">₹{(item.lifetimeValuePaise / 100).toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <span className="flex justify-end gap-3">
                        <Link
                          className="font-semibold underline"
                          href={`/admin/customers/${item.id}`}
                        >
                          View
                        </Link>
                        <button
                          className="font-semibold underline"
                          onClick={() => void customerStatus(item)}
                        >
                          {item.status === "active" ? "Block" : "Unblock"}
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
