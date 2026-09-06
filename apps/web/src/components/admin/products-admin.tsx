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
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Products</h1>
          <p className="mt-2 text-sm text-paper/60">
            {result.total} products · Manage your THREAD catalogue.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
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
    </div>
  );
}
