"use client";

import type { ProductAudience, ProductDetailDto, ProductStatus } from "@thread/types";
import { Button, ErrorState, Price, Skeleton } from "@thread/ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";

interface AdminProduct extends ProductDetailDto {
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface ProductPage {
  readonly items: readonly AdminProduct[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly pages: number;
}

interface CategoryOption {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

interface UploadSignature {
  readonly apiKey: string;
  readonly signature: string;
  readonly uploadUrl: string;
  readonly signedParameters: Readonly<Record<string, string | number>>;
}

interface CloudinaryUpload {
  readonly public_id: string;
  readonly secure_url: string;
  readonly width: number;
  readonly height: number;
  readonly format: "jpg" | "jpeg" | "png" | "webp" | "avif";
  readonly bytes: number;
  readonly resource_type: string;
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase("en-IN")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

function rupeesToPaise(value: FormDataEntryValue | null): number {
  const normalized = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("Enter prices in rupees with no more than two decimal places.");
  const [rupees = "0", decimal = ""] = normalized.split(".");
  return Number(rupees) * 100 + Number(decimal.padEnd(2, "0"));
}

function descriptionHtml(value: string): string {
  const escaped = value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("\n", "<br>")}</p>`)
    .join("");
}

async function attachImage(
  productId: string,
  file: File,
  alt: string,
  accessToken: string,
): Promise<void> {
  const signature = await apiRequest<UploadSignature>(
    "/catalog/admin/media/upload-signature",
    accessToken,
    { method: "POST" },
  );
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", signature.apiKey);
  body.set("signature", signature.signature);
  for (const [key, value] of Object.entries(signature.signedParameters))
    body.set(key, String(value));
  const response = await fetch(signature.uploadUrl, { method: "POST", body });
  if (!response.ok) throw new Error("The product was created, but its image upload failed.");
  const uploaded = (await response.json()) as CloudinaryUpload;
  if (uploaded.resource_type !== "image")
    throw new Error("The product was created, but the uploaded file was not an image.");
  const mimeType = (
    {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
    } as const
  )[uploaded.format];
  await apiRequest(`/catalog/admin/products/${productId}/media`, accessToken, {
    method: "POST",
    body: JSON.stringify({
      publicId: uploaded.public_id,
      secureUrl: uploaded.secure_url,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      mimeType,
      bytes: uploaded.bytes,
      alt,
      primary: true,
    }),
  });
}

const fieldClass = "min-h-11 rounded-md border border-ink/20 bg-paper px-3 text-sm";

export function ProductsAdmin() {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<readonly AdminProduct[]>([]);
  const [categories, setCategories] = useState<readonly CategoryOption[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [page, categoryOptions] = await Promise.all([
        apiRequest<ProductPage>("/catalog/admin/products?limit=100", accessToken),
        apiRequest<readonly CategoryOption[]>("/admin/categories", accessToken),
      ]);
      setProducts(page.items);
      setCategories(categoryOptions.filter((category) => category.active));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setBusy(true);
    setError("");
    setStatus("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const mrpPaise = rupeesToPaise(data.get("mrp"));
      const salePricePaise = rupeesToPaise(data.get("salePrice"));
      if (salePricePaise > mrpPaise) throw new Error("Sale price cannot exceed MRP.");
      const categoryId = String(data.get("categoryId") ?? "");
      const created = await apiRequest<AdminProduct>("/catalog/admin/products", accessToken, {
        method: "POST",
        body: JSON.stringify({
          title,
          slug,
          shortDescription: String(data.get("shortDescription") ?? ""),
          descriptionHtml: descriptionHtml(String(data.get("description") ?? "")),
          categoryIds: categoryId ? [categoryId] : [],
          collectionIds: [],
          audience: data.get("audience") as ProductAudience,
          brand: String(data.get("brand") ?? "THREAD"),
          tags: String(data.get("tags") ?? "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          fit: String(data.get("fit") ?? "") || undefined,
          material: null,
          care: [
            "Wash inside out in cold water.",
            "Hang dry or tumble dry on low heat.",
            "Never iron directly over a print.",
          ],
          featured: data.get("featured") === "on",
          status: data.get("status") as ProductStatus,
          seo: { noIndex: data.get("status") !== "active" },
          variants: [
            {
              sku: String(data.get("sku") ?? "").toUpperCase(),
              colour: String(data.get("colour") ?? ""),
              size: String(data.get("size") ?? "").toUpperCase(),
              attributes: {},
              mrpPaise,
              salePricePaise,
              taxRateBps: null,
              hsn: null,
              weightGrams: Number(data.get("weightGrams")),
              status: "active",
            },
          ],
        }),
      });
      const image = data.get("image");
      if (image instanceof File && image.size > 0)
        await attachImage(
          created.id,
          image,
          String(data.get("imageAlt") ?? "") || `${created.title} — THREAD`,
          accessToken,
        );
      form.reset();
      setTitle("");
      setSlug("");
      setShowForm(false);
      setStatus(
        created.status === "active"
          ? "Product created and published. Add stock in Inventory before selling."
          : "Draft product created. Add stock in Inventory, then activate it when reviewed.",
      );
      await load();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Product could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Catalogue</p>
          <h1 className="mt-2 text-3xl font-semibold">Products</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-paper/65">
            Create the core product and its first SKU here. Inventory is adjusted separately so
            every stock change remains auditable.
          </p>
        </div>
        <Button onClick={() => setShowForm((current) => !current)} type="button">
          {showForm ? "Close form" : "Add product"}
        </Button>
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-gold">
        {status}
      </p>
      {error ? (
        <ErrorState
          className="mt-4 bg-paper text-ink"
          description={error}
          title="Product action needs attention"
        />
      ) : null}

      {showForm ? (
        <form
          className="mt-6 rounded-lg bg-paper p-5 text-ink sm:p-7"
          encType="multipart/form-data"
          onSubmit={createProduct}
        >
          <h2 className="text-xl font-semibold">Product details</h2>
          <p className="mt-1 text-sm text-muted">
            Tax rate, HSN and material remain unset until the client and accountant confirm them.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Product title
              <input
                className={fieldClass}
                maxLength={180}
                onBlur={() => {
                  if (!slug) setSlug(slugify(title));
                }}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="grid gap-1 text-sm">
              URL slug
              <input
                className={fieldClass}
                maxLength={160}
                onChange={(event) => setSlug(slugify(event.target.value))}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                value={slug}
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Short description
              <input className={fieldClass} maxLength={320} name="shortDescription" required />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Description
              <textarea
                className="min-h-28 rounded-md border border-ink/20 bg-paper p-3 text-sm"
                name="description"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Audience
              <select className={fieldClass} defaultValue="unisex" name="audience">
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex</option>
                <option value="accessories">Accessories</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Category
              <select className={fieldClass} defaultValue="" name="categoryId">
                <option value="">No category yet</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Brand
              <input className={fieldClass} defaultValue="THREAD" maxLength={100} name="brand" />
            </label>
            <label className="grid gap-1 text-sm">
              Fit
              <input className={fieldClass} maxLength={80} name="fit" placeholder="e.g. Regular" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Tags, comma separated
              <input className={fieldClass} name="tags" placeholder="graphic, everyday" />
            </label>
          </div>

          <h2 className="mt-8 text-xl font-semibold">Initial variant</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-1 text-sm">
              SKU
              <input
                className={fieldClass}
                name="sku"
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Colour
              <input className={fieldClass} maxLength={80} name="colour" required />
            </label>
            <label className="grid gap-1 text-sm">
              Size
              <input className={fieldClass} maxLength={32} name="size" required />
            </label>
            <label className="grid gap-1 text-sm">
              MRP (₹)
              <input
                className={fieldClass}
                inputMode="decimal"
                name="mrp"
                placeholder="999.00"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Sale price (₹)
              <input
                className={fieldClass}
                inputMode="decimal"
                name="salePrice"
                placeholder="799.00"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              Weight (grams)
              <input
                className={fieldClass}
                max={100000}
                min={1}
                name="weightGrams"
                required
                type="number"
              />
            </label>
          </div>

          <h2 className="mt-8 text-xl font-semibold">Image and publishing</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Product image (optional)
              <input
                accept="image/jpeg,image/png,image/webp,image/avif"
                className={fieldClass}
                name="image"
                type="file"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Image alt text
              <input className={fieldClass} maxLength={240} name="imageAlt" />
            </label>
            <label className="grid gap-1 text-sm">
              Status
              <select className={fieldClass} defaultValue="draft" name="status">
                <option value="draft">Draft (recommended)</option>
                <option value="active">Active / published</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input className="size-5" name="featured" type="checkbox" />
              Feature this product
            </label>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button disabled={busy || !slug} type="submit">
              {busy ? "Creating…" : "Create product"}
            </Button>
            <p className="text-xs text-muted">
              New variants can be added through the catalogue API.
            </p>
          </div>
        </form>
      ) : null}

      <section className="mt-8 rounded-lg bg-paper p-5 text-ink sm:p-7">
        <h2 className="text-xl font-semibold">Catalogue products</h2>
        {loading ? (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : products.length ? (
          <div className="mt-5 divide-y divide-ink/10">
            {products.map((product) => (
              <article
                className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                key={product.id}
              >
                <div>
                  <h3 className="font-semibold">{product.title}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {product.variants.length} SKU{product.variants.length === 1 ? "" : "s"} ·{" "}
                    {product.audience} · {product.status}
                  </p>
                </div>
                <Price amount={product.minSalePricePaise} />
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted">No products yet. Use “Add product” to begin.</p>
        )}
      </section>
    </div>
  );
}
