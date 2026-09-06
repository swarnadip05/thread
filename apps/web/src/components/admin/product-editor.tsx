"use client";

import type { AdminProductDto, AdminProductVariantDto } from "@thread/types";
import { productWriteSchema } from "@thread/validation";
import { Button, Skeleton } from "@thread/ui";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { useAdminUnsavedChanges } from "./admin-unsaved-changes";
import { attachImage, descriptionHtml, rupeesToPaise, slugify } from "./product-editor-helpers";

const fieldClass = "min-h-11 w-full rounded-md border border-ink/20 bg-paper px-3 text-sm text-ink";
interface Option {
  id: string;
  name: string;
  active: boolean;
}
interface VariantRow {
  key: string;
  value?: AdminProductVariantDto;
}
function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className={fieldClass} {...props} />
    </label>
  );
}
function VariantFields({ row, index, remove }: { row: VariantRow; index: number; remove(): void }) {
  const variant = row.value;
  const prefix = `variant.${index}.`;
  const [mrp, setMrp] = useState(variant ? String(variant.mrpPaise / 100) : "");
  const [sale, setSale] = useState(variant ? String(variant.salePricePaise / 100) : "");
  const discount =
    Number(mrp) > 0 && Number(sale) <= Number(mrp)
      ? Math.round((1 - Number(sale) / Number(mrp)) * 100)
      : 0;
  return (
    <fieldset className="rounded-md border border-ink/15 p-4">
      <legend className="px-2 font-semibold">Variant {index + 1}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="SKU"
          defaultValue={variant?.sku}
          name={`${prefix}sku`}
          pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
          required
        />
        <Field
          label="Colour"
          defaultValue={variant?.colour}
          name={`${prefix}colour`}
          maxLength={80}
          required
        />
        <Field
          label="Size"
          defaultValue={variant?.size}
          name={`${prefix}size`}
          maxLength={32}
          required
        />
        <Field
          label="MRP (₹)"
          name={`${prefix}mrp`}
          value={mrp}
          onChange={(event) => setMrp(event.target.value)}
          inputMode="decimal"
          required
        />
        <Field
          label="Sale price (₹)"
          name={`${prefix}salePrice`}
          value={sale}
          onChange={(event) => setSale(event.target.value)}
          inputMode="decimal"
          required
        />
        <div className="self-end py-3 text-sm" aria-live="polite">
          Discount: {discount}%
        </div>
        <Field
          label="Weight (grams)"
          defaultValue={variant?.weightGrams}
          name={`${prefix}weightGrams`}
          type="number"
          min={1}
          max={100000}
          required
        />
        <Field
          label="Low stock threshold"
          defaultValue={variant?.reorderLevel ?? 0}
          name={`${prefix}reorderLevel`}
          type="number"
          min={0}
          max={1000000}
          required
        />
        {variant ? (
          <div className="self-center text-sm">
            <p>
              Stock: {variant.stockOnHand ?? variant.availableStock} on hand ·{" "}
              {variant.stockReserved ?? 0} reserved
            </p>
            <Link className="underline" href="/admin/inventory">
              Adjust stock in Inventory
            </Link>
          </div>
        ) : (
          <Field
            label="Initial stock quantity"
            defaultValue={0}
            name={`${prefix}initialStock`}
            type="number"
            min={0}
            max={1000000}
            required
          />
        )}
        <label className="grid gap-1 text-sm">
          Variant status
          <select
            className={fieldClass}
            name={`${prefix}status`}
            defaultValue={variant?.status ?? "active"}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      {!variant ? (
        <button
          className="mt-4 min-h-11 text-sm text-error underline"
          onClick={remove}
          type="button"
        >
          Remove variant
        </button>
      ) : (
        <p className="mt-4 text-xs text-muted">
          Set an existing variant to Inactive to preserve its inventory and order history.
        </p>
      )}
    </fieldset>
  );
}

export function ProductEditor({ productId }: { productId?: string }) {
  const { accessToken } = useAuth();
  const { setDirty } = useAdminUnsavedChanges();
  const [product, setProduct] = useState<AdminProductDto | null>(null);
  const [rows, setRows] = useState<VariantRow[]>([{ key: "initial" }]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  function establish(value: AdminProductDto) {
    setProduct(value);
    setTitle(value.title);
    setSlug(value.slug);
    setRows(value.variants.map((variant) => ({ key: variant.id, value: variant })));
    setFormVersion((version) => version + 1);
  }
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [categoryOptions, collectionOptions, existing] = await Promise.all([
        apiRequest<Option[]>("/admin/categories", accessToken),
        apiRequest<Option[]>("/admin/collections", accessToken),
        productId
          ? apiRequest<AdminProductDto>(`/admin/products/${productId}`, accessToken)
          : Promise.resolve(null),
      ]);
      setCategories(categoryOptions);
      setCollections(collectionOptions);
      if (existing) establish(existing);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Product editor could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, productId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      setDirty(false);
    };
  }, [load, setDirty]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    let saved = product;
    try {
      const text = (name: string) => String(data.get(name) ?? "").trim();
      const description = text("description");
      const input = productWriteSchema.safeParse({
        title,
        slug,
        shortDescription: text("shortDescription"),
        descriptionHtml: /<\/?[a-z][\s\S]*>/i.test(description)
          ? description
          : descriptionHtml(description),
        audience: text("audience"),
        brand: text("brand"),
        categoryIds: data.getAll("categoryIds"),
        collectionIds: data.getAll("collectionIds"),
        fit: text("fit"),
        material: text("material") || null,
        care: text("care")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        tags: text("tags")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: text("status"),
        featured: data.has("featured"),
        newArrival: data.has("newArrival"),
        seo: {
          title: text("seoTitle"),
          description: text("seoDescription"),
          noIndex: data.has("noIndex"),
        },
        variants: rows.map((row, index) => {
          const prefix = `variant.${index}.`;
          const variant = row.value;
          return {
            ...(variant
              ? { id: variant.id, colourHex: variant.colourHex, dimensionsMm: variant.dimensionsMm }
              : { initialStock: Number(text(`${prefix}initialStock`)) }),
            sku: text(`${prefix}sku`),
            colour: text(`${prefix}colour`),
            size: text(`${prefix}size`),
            mrpPaise: rupeesToPaise(data.get(`${prefix}mrp`)),
            salePricePaise: rupeesToPaise(data.get(`${prefix}salePrice`)),
            weightGrams: Number(text(`${prefix}weightGrams`)),
            reorderLevel: Number(text(`${prefix}reorderLevel`)),
            status: text(`${prefix}status`),
            attributes: variant?.attributes ?? {},
            taxRateBps: variant?.taxRateBps ?? null,
            hsn: variant?.hsn ?? null,
          };
        }),
      });
      if (!input.success)
        throw new Error(
          input.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · "),
        );
      const files = data
        .getAll("images")
        .filter((file): file is File => file instanceof File && file.size > 0);
      if (
        files.some(
          (file) =>
            file.size > 15000000 ||
            !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type),
        )
      )
        throw new Error("Images must be JPEG, PNG, WebP or AVIF, up to 15 MB each.");
      if (files.length && !text("imageAlt")) throw new Error("Enter descriptive image alt text.");
      // Check provider availability before creating a record, so configuration errors preserve the form.
      if (files.length)
        await apiRequest("/admin/media/upload-signature", accessToken, { method: "POST" });
      const requestedStatus = input.data.status;
      saved = await apiRequest<AdminProductDto>(
        product ? `/admin/products/${product.id}` : "/admin/products",
        accessToken,
        {
          method: product ? "PATCH" : "POST",
          body: JSON.stringify({
            ...input.data,
            status: !product && files.length ? "draft" : requestedStatus,
          }),
        },
      );
      establish(saved);
      setDirty(false);
      for (const [index, file] of files.entries()) {
        await attachImage(
          saved.id,
          file,
          files.length > 1 ? `${text("imageAlt")} — view ${index + 1}` : text("imageAlt"),
          accessToken,
          !saved.media.length && index === 0,
        );
      }
      if (saved.status !== requestedStatus)
        await apiRequest(`/admin/products/${saved.id}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify({ status: requestedStatus }),
        });
      establish(await apiRequest<AdminProductDto>(`/admin/products/${saved.id}`, accessToken));
      setNotice("Product saved. Active products are available in the storefront catalogue.");
      window.history.replaceState(null, "", `/admin/products/${saved.id}/edit`);
    } catch (reason) {
      setError(
        `${saved && saved !== product ? "Product details were saved. " : ""}${reason instanceof Error ? reason.message : "Product could not be saved."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function mediaAction(action: "primary" | "remove", publicId: string) {
    if (!accessToken || !product) return;
    if (action === "remove" && !window.confirm("Remove this product image?")) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/admin/products/${product.id}/media/${action === "primary" ? "order" : "delete"}`,
        accessToken,
        {
          method: action === "primary" ? "PUT" : "POST",
          body: JSON.stringify(
            action === "primary"
              ? {
                  orderedPublicIds: product.media.map((media) => media.publicId),
                  primaryPublicId: publicId,
                }
              : { publicId },
          ),
        },
      );
      const updated = await apiRequest<AdminProductDto>(
        `/admin/products/${product.id}`,
        accessToken,
      );
      setProduct(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Image could not be updated.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Skeleton className="h-96 w-full" />;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">{product ? "Edit product" : "Add product"}</h1>
        <Link className="underline" href="/admin/products">
          All products
        </Link>
      </div>
      {error ? (
        <div role="alert" className="mt-5 rounded-md bg-paper p-4 text-error">
          {error}
          {!product && productId ? (
            <button className="ml-3 underline" onClick={() => void load()} type="button">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="mt-5 rounded-md bg-paper p-4 text-ink">
          {notice}{" "}
          {product?.status === "active" ? (
            <Link className="underline" href={`/shop/${product.slug}`}>
              View product
            </Link>
          ) : null}
        </p>
      ) : null}
      {productId && !product ? null : (
        <form
          key={formVersion}
          className="mt-6 space-y-7 rounded-lg bg-paper p-5 text-ink sm:p-7"
          onChange={() => setDirty(true)}
          onSubmit={save}
        >
          <fieldset disabled={busy} className="space-y-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Product name"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (!product && (!slug || slug === slugify(title)))
                    setSlug(slugify(event.target.value));
                }}
                minLength={2}
                maxLength={180}
                required
              />
              <Field
                label="Slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={160}
                required
              />
              <div className="sm:col-span-2">
                <Field
                  label="Short description"
                  name="shortDescription"
                  defaultValue={product?.shortDescription}
                  maxLength={320}
                  required
                />
              </div>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Full description
                <textarea
                  className={`${fieldClass} min-h-36 py-3`}
                  name="description"
                  defaultValue={product?.descriptionHtml}
                  maxLength={50000}
                  required
                />
                <span className="text-xs text-muted">
                  Plain text or basic HTML for paragraphs, lists and emphasis.
                </span>
              </label>
              <label className="grid gap-1 text-sm">
                Gender / audience
                <select
                  className={fieldClass}
                  defaultValue={product?.audience ?? "unisex"}
                  name="audience"
                >
                  {["men", "women", "unisex", "accessories"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <Field
                label="Brand"
                defaultValue={product?.brand ?? "THREAD"}
                name="brand"
                maxLength={100}
                required
              />
              {[
                {
                  label: "Category",
                  name: "categoryIds",
                  options: categories,
                  selected: product?.categoryIds ?? [],
                },
                {
                  label: "Collection",
                  name: "collectionIds",
                  options: collections,
                  selected: product?.collectionIds ?? [],
                },
              ].map((group) => (
                <label className="grid gap-1 text-sm" key={group.name}>
                  {group.label}
                  <select
                    className={`${fieldClass} min-h-24 py-2`}
                    multiple
                    name={group.name}
                    defaultValue={[...group.selected]}
                  >
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.active ? "" : " (inactive)"}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">
                    Select one or more; use Command/Ctrl to change selections.
                  </span>
                </label>
              ))}
              <Field label="Fit" defaultValue={product?.fit} name="fit" maxLength={80} />
              <Field
                label="Material"
                defaultValue={product?.material}
                name="material"
                maxLength={240}
              />
              <label className="grid gap-1 text-sm sm:col-span-2">
                Care instructions (one per line)
                <textarea
                  className={`${fieldClass} min-h-24 py-3`}
                  name="care"
                  defaultValue={product?.care.join("\n")}
                />
              </label>
              <div className="sm:col-span-2">
                <Field
                  label="Tags (comma separated)"
                  defaultValue={product?.tags.join(", ")}
                  name="tags"
                />
              </div>
            </div>
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">Variants and inventory</h2>
              {rows.map((row, index) => (
                <VariantFields
                  key={`${formVersion}.${row.key}`}
                  row={row}
                  index={index}
                  remove={() => {
                    setRows(rows.filter((item) => item.key !== row.key));
                    setDirty(true);
                  }}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRows([...rows, { key: crypto.randomUUID() }]);
                  setDirty(true);
                }}
              >
                Add variant
              </Button>
            </section>
            <section>
              <h2 className="mb-4 text-xl font-semibold">Product images</h2>
              {product?.media.length ? (
                <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {product.media.map((media) => (
                    <div key={media.publicId} className="space-y-2">
                      <Image
                        className="aspect-square w-full rounded-md object-cover"
                        alt={media.alt}
                        src={media.secureUrl}
                        width={300}
                        height={300}
                      />
                      <p className="text-xs">{media.alt}</p>
                      <button
                        type="button"
                        className="mr-3 min-h-11 text-xs underline"
                        onClick={() => void mediaAction("primary", media.publicId)}
                      >
                        {media.primary ? "Primary image" : "Make primary"}
                      </button>
                      <button
                        type="button"
                        className="min-h-11 text-xs text-error underline"
                        onClick={() => void mediaAction("remove", media.publicId)}
                      >
                        Remove image
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Upload images"
                  name="images"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                />
                <Field label="Image alt text" name="imageAlt" maxLength={200} />
              </div>
              <p className="mt-3 text-xs text-muted">
                Use images you own or have permission to publish. Minimum 300 × 300 pixels; maximum
                15 MB per image.
              </p>
            </section>
            <section>
              <h2 className="mb-4 text-xl font-semibold">Publishing and SEO</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Product status
                  <select
                    className={fieldClass}
                    defaultValue={product?.status ?? "draft"}
                    name="status"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active / published</option>
                    <option value="inactive">Inactive / unpublished</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-5">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="featured"
                      defaultChecked={product?.featured ?? false}
                    />
                    Featured
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="newArrival"
                      defaultChecked={product?.newArrival ?? true}
                    />
                    New arrival
                  </label>
                </div>
                <Field
                  label="SEO title"
                  name="seoTitle"
                  defaultValue={product?.seo?.title}
                  maxLength={70}
                />
                <Field
                  label="SEO description"
                  name="seoDescription"
                  defaultValue={product?.seo?.description}
                  maxLength={180}
                />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="noIndex"
                    defaultChecked={product?.seo?.noIndex ?? false}
                  />
                  Hide from search engines
                </label>
              </div>
              <p className="mt-3 text-xs text-muted">
                Best sellers are ranked from delivered orders. Ratings come from moderated customer
                reviews.
              </p>
            </section>
            <Button disabled={busy || !rows.length} type="submit">
              {busy ? "Saving…" : product ? "Save changes" : "Create product"}
            </Button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
