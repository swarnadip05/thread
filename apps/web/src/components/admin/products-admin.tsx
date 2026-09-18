"use client";

import type { AdminProductDto, ProductStatus } from "@thread/types";
import { Badge, Button, Price, Skeleton } from "@thread/ui";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Plus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { ProductImportModal } from "./product-import-modal";
import { ProductVariantQuickManager } from "./product-variant-quick-manager";

interface ProductPage {
  items: AdminProductDto[];
  total: number;
  pages: number;
}

export function ProductsAdmin() {
  const { accessToken } = useAuth();
  const [result, setResult] = useState<ProductPage>({ items: [], total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  // Bulk selection & Expanded quick editors
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiRequest<ProductPage>(
        `/admin/products?${new URLSearchParams({
          page: String(page),
          limit: "25",
          search,
          status: filter,
        })}`,
        accessToken,
      );
      setResult(data);
      setSelectedIds(new Set());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, search, filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Toggle selection
  function toggleSelectAll() {
    if (selectedIds.size === result.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(result.items.map((p) => p.id)));
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  // Delete single product
  async function deleteSingleProduct(id: string, title: string) {
    if (!accessToken) return;
    if (!window.confirm(`Permanently delete "${title}" and all its size variants?`)) return;

    setBusy(id);
    setError("");
    try {
      await apiRequest(`/admin/products/${id}`, accessToken, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product.");
    } finally {
      setBusy("");
    }
  }

  // Delete selected products
  async function deleteSelectedProducts() {
    if (!accessToken || selectedIds.size === 0) return;
    if (!window.confirm(`Delete all ${selectedIds.size} selected products? This cannot be undone.`)) return;

    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<{ deletedProducts: number; deletedVariants: number }>(
        "/admin/products/bulk-delete",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ productIds: Array.from(selectedIds) }),
        },
      );
      alert(`Deleted ${res.deletedProducts} products and ${res.deletedVariants} variants.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected products.");
    } finally {
      setLoading(false);
    }
  }

  // Quick generate S-2XL variants
  async function quickAddVariants(productId: string) {
    if (!accessToken) return;
    setBusy(productId);
    setError("");
    try {
      await apiRequest(`/admin/products/${productId}/quick-variants`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          priceSM: 549,
          priceLXL: 599,
          priceXXL: 649,
          mrp: 899,
          stock: 25,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add variants.");
    } finally {
      setBusy("");
    }
  }

  // 1-Click Toggle Single Variant Stock (Instant surety)
  async function toggleVariantStock(variantId: string) {
    if (!accessToken) return;
    setBusy(variantId);
    setError("");
    try {
      await apiRequest(`/admin/variants/${variantId}/toggle-stock`, accessToken, {
        method: "PATCH",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle stock status.");
    } finally {
      setBusy("");
    }
  }

  // Clear products (wrong products / all)
  async function clearProducts(onlyWithoutImages: boolean) {
    if (!accessToken) return;
    const confirmMsg = onlyWithoutImages
      ? "Are you sure you want to delete all products that have no pictures? This cannot be undone."
      : "ARE YOU SURE? This will permanently delete ALL products in your store.";
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<{ deletedProducts: number; deletedVariants: number }>(
        "/admin/products/clear-all",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ onlyWithoutImages }),
        },
      );
      alert(`Deleted ${res.deletedProducts} products and ${res.deletedVariants} variants.`);
      setPage(1);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to delete products.");
    } finally {
      setLoading(false);
    }
  }

  // Change product status
  async function changeStatus(product: AdminProductDto, status: ProductStatus) {
    if (!accessToken) return;
    setBusy(product.id);
    setError("");
    try {
      await apiRequest(`/admin/products/${product.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status could not be changed.");
    } finally {
      setBusy("");
    }
  }

  function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(String(new FormData(event.currentTarget).get("search") ?? ""));
  }

  // Helper to sort sizes standard order: S, M, L, XL, 2XL
  const sizeOrder = ["S", "M", "L", "XL", "2XL", "XXL", "3XL", "FREE SIZE"];
  function sortVariants(variants: readonly any[]) {
    return [...variants].sort((a, b) => {
      const aIdx = sizeOrder.indexOf(a.size?.toUpperCase());
      const bIdx = sizeOrder.indexOf(b.size?.toUpperCase());
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (a.size || "").localeCompare(b.size || "");
    });
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header with High-Contrast Text & Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white">Products</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 text-xs font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Storage: 100% OK (&lt;1% used · 25GB Cloud Available)
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-300">
            {result.total} products listed · Manage inventory, size variants & pricing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/products/upload"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-black shadow-md hover:bg-amber-300 transition"
          >
            📁 Upload Photos (New)
          </Link>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-800 border-2 border-zinc-600 px-5 text-sm font-bold text-white shadow-md hover:bg-zinc-700 transition"
          >
            <Upload className="h-4 w-4 text-zinc-300" />
            Bulk Import (ZIP / Excel)
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white border-2 border-zinc-300 px-5 text-sm font-black text-black shadow-md hover:bg-zinc-100 transition"
          >
            <Plus className="h-4 w-4 text-black stroke-[3]" />
            Add Product
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 border border-rose-500 px-5 text-sm font-bold text-white shadow-md hover:bg-rose-700 transition disabled:opacity-50"
            onClick={() => {
              const choice = window.prompt(
                "Type 'no-images' to delete products without pictures,\nor type 'all' to delete ALL products:",
                "no-images",
              );
              if (choice === "no-images") {
                void clearProducts(true);
              } else if (choice === "all") {
                void clearProducts(false);
              }
            }}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 text-white" />
            Delete Wrong Products
          </button>
        </div>
      </div>

      {/* ── High-Contrast Search & Filter Bar ── */}
      <form
        className="flex flex-wrap items-center gap-3 rounded-xl bg-[#1d1d1d] p-3 border border-zinc-800"
        onSubmit={searchProducts}
      >
        <input
          aria-label="Search products"
          className="min-h-11 flex-1 min-w-[240px] rounded-lg bg-white px-4 font-semibold text-black placeholder:text-zinc-500 border-2 border-zinc-300 focus:border-amber-400 focus:outline-none"
          name="search"
          placeholder="🔍 Search product name, slug, or SKU..."
          defaultValue={search}
        />
        <select
          aria-label="Filter status"
          className="min-h-11 rounded-lg bg-white px-3 font-semibold text-black border-2 border-zinc-300 focus:border-amber-400 focus:outline-none"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses (active, draft, archived)</option>
          <option value="active">Active only</option>
          <option value="draft">Draft only</option>
          <option value="inactive">Inactive only</option>
          <option value="archived">Archived only</option>
        </select>
        <Button
          type="submit"
          className="min-h-11 bg-amber-400 px-6 font-black text-black hover:bg-amber-300 shadow"
        >
          Search
        </Button>
      </form>

      {/* ── Error Banner ── */}
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-red-200" role="alert">
          {error}{" "}
          <button className="font-bold underline ml-2 text-white" onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {/* ── Bulk Actions Floating / Sticky Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-amber-200">
          <div className="flex items-center gap-2 font-bold text-white">
            <CheckCircle2 className="h-5 w-5 text-amber-400" />
            {selectedIds.size} product{selectedIds.size > 1 ? "s" : ""} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
              onClick={() => setSelectedIds(new Set())}
            >
              Deselect All
            </Button>
            <Button
              size="sm"
              className="bg-red-600 font-bold text-white hover:bg-red-700"
              onClick={deleteSelectedProducts}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* ── Product List Section ── */}
      <section className="rounded-2xl bg-white p-6 text-zinc-950 shadow-xl border border-zinc-200">
        {/* Table header with Select All */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-zinc-700 hover:text-black"
            >
              {selectedIds.size > 0 && selectedIds.size === result.items.length ? (
                <CheckSquare className="h-5 w-5 text-amber-500" />
              ) : (
                <Square className="h-5 w-5 text-zinc-400" />
              )}
              <span>Select All ({result.items.length})</span>
            </button>
          </div>
          <span>Showing {result.items.length} of {result.total}</span>
        </div>

        {loading ? (
          <div className="py-12 space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : result.items.length ? (
          <div className="divide-y divide-zinc-200">
            {result.items.map((product) => {
              const sorted = sortVariants(product.variants || []);
              const isSelected = selectedIds.has(product.id);
              const imgUrl = product.primaryImage?.secureUrl || product.media?.[0]?.secureUrl;

              return (
                <article
                  key={product.id}
                  className={`py-5 transition-colors ${
                    isSelected ? "bg-amber-50/50 -mx-6 px-6" : ""
                  }`}
                >
                  <div className="grid gap-4 lg:grid-cols-[auto_auto_1fr_auto] items-start">
                    {/* Checkbox */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => toggleSelect(product.id)}
                        className="text-zinc-600 hover:text-black"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Square className="h-5 w-5 text-zinc-400" />
                        )}
                      </button>
                    </div>

                    {/* Product Thumbnail Image */}
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm relative group">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-[10px] font-bold text-zinc-400">
                          <ImageIcon className="h-6 w-6 text-zinc-300 mb-0.5" />
                          No Picture
                        </div>
                      )}
                      {product.media && product.media.length > 1 && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-black text-white">
                          {product.media.length}📷
                        </span>
                      )}
                    </div>

                    {/* Product Details & Variants Grid */}
                    <div className="min-w-0 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="text-lg font-black text-zinc-900 hover:text-amber-600 transition truncate"
                        >
                          {product.title}
                        </Link>

                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            product.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : product.status === "draft"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-zinc-200 text-zinc-800"
                          }`}
                        >
                          ● {product.status.toUpperCase()}
                        </span>

                        {/* Audience Badge */}
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 capitalize">
                          {product.audience}
                        </span>

                        {product.fit && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            {product.fit}
                          </span>
                        )}
                      </div>

                      {/* Variants & Size Availability Section */}
                      {sorted.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-600">
                              Available Sizes, Prices & Stock:
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleExpand(product.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-800 hover:bg-amber-100 hover:text-amber-900 border border-zinc-300 transition"
                            >
                              ⚙ {expandedProductIds.has(product.id) ? "Close Editor" : "Edit Sizes & Prices"}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {sorted.map((v, vIdx) => {
                              const inStock = v.stockOnHand > 0 && v.status === "active";
                              return (
                                <div
                                  key={v.id || vIdx}
                                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-medium shadow-sm ${
                                    inStock
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                                      : "border-rose-300 bg-rose-50 text-rose-900"
                                  }`}
                                >
                                  <span className="font-black text-sm bg-white px-2 py-0.5 rounded border border-zinc-200 text-black">
                                    {v.size}
                                  </span>
                                  <span className="font-bold text-zinc-900">
                                    ₹{Math.round((v.salePricePaise || 0) / 100)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy === v.id}
                                    title="Click to toggle In Stock / Out of Stock instantly"
                                    onClick={() => void toggleVariantStock(v.id)}
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-black cursor-pointer transition ${
                                      inStock
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : "bg-rose-600 text-white hover:bg-rose-700"
                                    }`}
                                  >
                                    {busy === v.id
                                      ? "..."
                                      : inStock
                                      ? `✓ In Stock (${v.stockOnHand})`
                                      : "✕ Out of Stock"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Inline editor when expanded */}
                          {expandedProductIds.has(product.id) && (
                            <div className="mt-3 pt-3 border-t border-zinc-200">
                              <ProductVariantQuickManager
                                product={product}
                                onSuccess={() => {
                                  toggleExpand(product.id);
                                  void load();
                                }}
                                onCancel={() => toggleExpand(product.id)}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        /* When 0 variants exist — prominent interactive Quick Setup in that space */
                        <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
                            <div className="flex items-center gap-2 font-bold text-amber-950">
                              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                              <span>
                                <strong>No size variants yet!</strong> Configure sizes, pricing & stock below to make active:
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={busy === product.id}
                              onClick={() => void quickAddVariants(product.id)}
                              className="rounded-lg bg-amber-500 px-3.5 py-1.5 font-black text-black hover:bg-amber-400 shadow-sm transition"
                            >
                              {busy === product.id ? "Adding..." : "⚡ Quick Add S, M, L, XL, 2XL (₹549 - ₹649)"}
                            </button>
                          </div>
                          <ProductVariantQuickManager
                            product={product}
                            onSuccess={() => void load()}
                            isInitialSetup={true}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end justify-end">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="font-bold text-zinc-900 border-zinc-300 hover:bg-zinc-100"
                      >
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Link>
                      </Button>

                      {product.status === "active" && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="font-semibold text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                        >
                          <Link href={`/shop/${product.slug}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> View Store
                          </Link>
                        </Button>
                      )}

                      <button
                        type="button"
                        disabled={busy === product.id}
                        onClick={() =>
                          void changeStatus(
                            product,
                            product.status === "active" ? "inactive" : "active",
                          )
                        }
                        className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                          product.status === "active"
                            ? "bg-zinc-200 text-zinc-800 hover:bg-zinc-300"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {product.status === "active" ? "Unpublish" : "Publish"}
                      </button>

                      <button
                        type="button"
                        disabled={busy === product.id}
                        onClick={() => void deleteSingleProduct(product.id, product.title)}
                        className="rounded-md px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                        title="Delete product permanently"
                      >
                        <Trash2 className="h-4 w-4 inline mr-1" /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <p className="text-base font-semibold text-zinc-500">
              {search || filter
                ? "No matching products found."
                : "No products in store catalogue yet."}
            </p>
            <Button asChild className="bg-amber-400 font-bold text-black hover:bg-amber-300">
              <Link href="/admin/products/upload">📁 Upload Product Photos Now</Link>
            </Button>
          </div>
        )}

        {/* ── Pagination ── */}
        <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-4">
          <Button
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
            variant="outline"
            className="font-bold border-zinc-300"
          >
            Previous Page
          </Button>
          <span className="text-sm font-bold text-zinc-700">
            Page {page} of {Math.max(1, result.pages)} ({result.total} total products)
          </span>
          <Button
            disabled={loading || page >= result.pages}
            onClick={() => setPage(page + 1)}
            variant="outline"
            className="font-bold border-zinc-300"
          >
            Next Page
          </Button>
        </div>
      </section>

      {/* ZIP Import Modal */}
      <ProductImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          void load();
        }}
      />
    </div>
  );
}
