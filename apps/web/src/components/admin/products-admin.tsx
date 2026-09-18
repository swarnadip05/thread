"use client";

import type { AdminProductDto, ProductStatus } from "@thread/types";
import { Button, Price, Skeleton } from "@thread/ui";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

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
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [zipUploading, setZipUploading] = useState(false);
  const [zipResult, setZipResult] = useState<{ importedCount: number; variantCount: number; categories: string[]; errors?: string[] } | null>(null);
  const [zipError, setZipError] = useState("");
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      setResult(
        await apiRequest<ProductPage>(
          `/admin/products?${new URLSearchParams({ page: String(page), limit: "25", search, status: filter })}`,
          accessToken,
        ),
      );
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
  async function changeStatus(product: AdminProductDto, status: ProductStatus) {
    if (
      !accessToken ||
      (status === "archived" &&
        !window.confirm(
          `Archive “${product.title}”? It will leave the storefront; order history is preserved.`,
        ))
    )
      return;
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

  async function handleZipFileSelect(file: File) {
    if (!accessToken) return;
    setZipUploading(true);
    setZipError("");
    setZipResult(null);

    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await apiRequest<{ importedCount: number; variantCount: number; categories: string[]; errors?: string[] }>(
        "/admin/products/import-zip",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ zipBase64: base64Data }),
        },
      );

      setZipResult(res);
      await load();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Failed to process ZIP inventory file.");
    } finally {
      setZipUploading(false);
    }
  }

  async function handleAutoSeed100() {
    if (!accessToken) return;
    setZipUploading(true);
    setZipError("");
    setZipResult(null);
    setZipModalOpen(true);

    try {
      const res = await apiRequest<{ importedCount: number; variantCount: number; categories: string[]; errors?: string[] }>(
        "/admin/products/auto-seed-100",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setZipResult(res);
      await load();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "Failed to auto-generate 100 inventory products.");
    } finally {
      setZipUploading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Products</h1>
          <p className="mt-2 text-sm text-paper/60">
            {result.total} products · Manage your THREAD catalogue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void handleAutoSeed100()} disabled={zipUploading}>
            {zipUploading ? "Auto-Seeding 100 Products..." : "⚡ Auto-Add 100 Inventory"}
          </Button>
          <Button variant="outline" onClick={() => setZipModalOpen(true)}>
            Import ZIP File
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">Add product</Link>
          </Button>
        </div>
      </div>
      <form className="mt-6 flex flex-wrap gap-3" onSubmit={searchProducts}>
        <input
          aria-label="Search products"
          className="min-h-11 rounded-md bg-paper px-3 text-ink"
          name="search"
          placeholder="Search product name or SKU"
        />
        <select
          aria-label="Filter status"
          className="min-h-11 rounded-md bg-paper px-3 text-ink"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["draft", "active", "inactive", "archived"].map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <Button type="submit">Search</Button>
      </form>
      {error ? (
        <div className="mt-5 rounded-md bg-paper p-4 text-error" role="alert">
          {error}{" "}
          <button className="underline" onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      ) : null}
      <section className="mt-6 rounded-lg bg-paper p-5 text-ink">
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : result.items.length ? (
          <div className="divide-y divide-ink/10">
            {result.items.map((product) => (
              <article className="grid gap-4 py-5 lg:grid-cols-[1fr_auto]" key={product.id}>
                <div>
                  <Link
                    className="font-semibold underline-offset-4 hover:underline"
                    href={`/admin/products/${product.id}/edit`}
                  >
                    {product.title}
                  </Link>
                  <p className="my-2 text-sm text-muted">
                    {product.status} · {product.variants.length} variants ·{" "}
                    {product.available ? "In stock" : "Out of stock"}
                  </p>
                  <Price amount={product.minSalePricePaise} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link
                    className="min-h-11 content-center underline"
                    href={`/admin/products/${product.id}/edit`}
                  >
                    Edit
                  </Link>
                  {product.status === "active" ? (
                    <Link
                      className="min-h-11 content-center underline"
                      href={`/shop/${product.slug}`}
                    >
                      View product
                    </Link>
                  ) : null}
                  <button
                    className="min-h-11 underline"
                    disabled={busy === product.id}
                    onClick={() =>
                      void changeStatus(
                        product,
                        product.status === "active" ? "inactive" : "active",
                      )
                    }
                    type="button"
                  >
                    {product.status === "active" ? "Unpublish" : "Publish"}
                  </button>
                  {product.status !== "archived" ? (
                    <button
                      className="min-h-11 text-error underline"
                      disabled={busy === product.id}
                      onClick={() => void changeStatus(product, "archived")}
                      type="button"
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-muted">
            {search || filter
              ? "No matching products."
              : "No products yet. Add your first product to begin."}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between gap-4">
          <Button
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {Math.max(1, result.pages)}
          </span>
          <Button
            disabled={loading || page >= result.pages}
            onClick={() => setPage(page + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </section>

      {zipModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 pb-4">
              <h2 className="text-xl font-semibold">Bulk ZIP Inventory Upload</h2>
              <button
                className="text-muted hover:text-ink"
                onClick={() => {
                  setZipModalOpen(false);
                  setZipResult(null);
                  setZipError("");
                }}
                type="button"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm text-paper/70">
              Upload a `.zip` document containing product images and `manifest.json` (or `products.json`). Products will automatically be placed into their designated categories (**Men Topwear: T-Shirts, Oversized T-Shirts, Classic Fit T-Shirts**, **Women Oversized / Regular**, **Accessories**).
            </p>

            <div className="mt-5 rounded-lg border-2 border-dashed border-ink/20 p-6 text-center hover:border-accent">
              <input
                accept=".zip,application/zip"
                className="hidden"
                id="zip-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleZipFileSelect(file);
                }}
                type="file"
              />
              <label
                className="cursor-pointer font-medium text-accent hover:underline"
                htmlFor="zip-file-input"
              >
                {zipUploading ? "Uploading & Processing ZIP..." : "Click to select .ZIP Inventory archive"}
              </label>
            </div>

            {zipUploading ? (
              <div className="mt-4 text-center text-sm text-muted">
                Extracting archive, assigning categories, and saving products...
              </div>
            ) : null}

            {zipError ? (
              <div className="mt-4 rounded-md bg-error/10 p-3 text-sm text-error">
                {zipError}
              </div>
            ) : null}

            {zipResult ? (
              <div className="mt-4 rounded-md bg-success/10 p-4 text-sm text-success">
                <p className="font-semibold">Import Complete!</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>{zipResult.importedCount} Products Imported</li>
                  <li>{zipResult.variantCount} Product Variants Created</li>
                  <li>Designated Categories: {zipResult.categories.join(", ")}</li>
                </ul>
                {zipResult.errors?.length ? (
                  <div className="mt-2 text-xs text-error">
                    <p className="font-medium">Warnings:</p>
                    {zipResult.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3 border-t border-ink/10 pt-4">
              <Button
                onClick={() => {
                  setZipModalOpen(false);
                  setZipResult(null);
                  setZipError("");
                }}
                variant="outline"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
