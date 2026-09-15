import { execFileSync } from "node:child_process";

import { expect, request as playwrightRequest, test } from "@playwright/test";
import { readRuntime } from "./runtime.js";

interface MongoProduct {
  readonly audience: string;
  readonly categoryIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly id: string;
  readonly media: readonly {
    readonly alt: string;
    readonly primary: boolean;
    readonly publicId: string;
    readonly secureUrl: string;
  }[];
  readonly publishedAt: string | null;
  readonly status: string;
  readonly variants: readonly {
    readonly id: string;
    readonly salePricePaise: number;
    readonly size: string;
    readonly sku: string;
    readonly status: string;
    readonly stockOnHand: number;
  }[];
}

function productInMongo(slug: string): MongoProduct | null {
  const uri = process.env.E2E_MONGODB_URI;
  if (!uri) throw new Error("E2E_MONGODB_URI is required for catalogue persistence checks.");
  const databaseName = decodeURIComponent(new URL(uri).pathname.replace(/^\//, ""));
  if (databaseName !== "thread_commerce_e2e")
    throw new Error(
      "Catalogue E2E assertions may only read the dedicated thread_commerce_e2e database.",
    );
  const evaluation = `
    const target = db.getSiblingDB(${JSON.stringify(databaseName)});
    const product = target.getCollection("products").findOne({ slug: ${JSON.stringify(slug)} });
    if (!product) {
      print("null");
    } else {
      const variants = target
        .getCollection("productvariants")
        .find({ productId: product._id })
        .sort({ size: 1 })
        .toArray()
        .map((variant) => ({
          id: String(variant._id),
          salePricePaise: variant.salePricePaise,
          size: variant.size,
          sku: variant.sku,
          status: variant.status,
          stockOnHand: variant.stockOnHand,
        }));
      print(JSON.stringify({
        audience: product.audience,
        categoryIds: product.categoryIds.map(String),
        collectionIds: product.collectionIds.map(String),
        id: String(product._id),
        media: product.media.map((media) => ({
          alt: media.alt,
          primary: media.primary,
          publicId: media.publicId,
          secureUrl: media.secureUrl,
        })),
        publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
        status: product.status,
        variants,
      }));
    }
  `;
  const output = execFileSync("mongosh", [uri, "--quiet", "--eval", evaluation], {
    encoding: "utf8",
  }).trim();
  return JSON.parse(output) as MongoProduct | null;
}

test("admin writes live Mongo catalogue data that immediately reaches the storefront", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const { admin } = await readRuntime();
  const suffix = Date.now().toString();
  const name = `Verification tee ${suffix}`;
  const slug = `verification-tee-${suffix}`;
  const category = `Test men category ${suffix}`;
  const categorySlug = `test-men-category-${suffix}`;
  const collection = `Test collection ${suffix}`;
  const cloudName = process.env.E2E_CLOUDINARY_CLOUD_NAME || "thread-e2e";
  const mediaAlt = `E2E primary image for ${name}`;
  const mediaPublicId = `thread/products/e2e/${slug}`;
  const mediaSecureUrl = `https://res.cloudinary.com/${cloudName}/image/upload/v1/${mediaPublicId}.webp`;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email address").fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill(admin.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const [kind, title] of [
    ["categories", category],
    ["collections", collection],
  ] as const) {
    await page.goto(`/admin/${kind}`);
    await page.getByLabel("Name", { exact: true }).fill(title);
    if (kind === "categories")
      await page.getByLabel("Audience", { exact: true }).selectOption("men");
    await page
      .getByRole("button", { name: kind === "categories" ? "Save category" : "Save collection" })
      .click();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Add product", exact: true }).click();
  await page.getByLabel("Product name", { exact: true }).fill(name);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);
  await page
    .getByLabel("Short description")
    .fill("A clearly labelled product used for verification.");
  await page
    .getByLabel("Full description")
    .fill("Cotton tee used only for automated acceptance testing.");
  await page.getByLabel("Gender / audience", { exact: true }).selectOption("men");
  await page.getByLabel("Category", { exact: false }).selectOption({ label: category });
  await page.getByLabel("Collection", { exact: false }).selectOption({ label: collection });
  await page.getByLabel("Material", { exact: true }).fill("Cotton");
  await page.getByLabel("Fit", { exact: true }).fill("Regular");
  await page.getByLabel("Care instructions", { exact: false }).fill("Wash cold.\nLine dry.");
  await page.getByLabel("SKU", { exact: true }).fill(`VERIFY-${suffix}-M`);
  await page.getByLabel("Colour", { exact: true }).fill("Black");
  await page.getByLabel("Size", { exact: true }).fill("M");
  await page.getByLabel("MRP (₹)", { exact: true }).fill("1000");
  await page.getByLabel("Sale price (₹)", { exact: true }).fill("800");
  await page.getByLabel("Weight (grams)", { exact: true }).fill("250");
  await page.getByLabel("Initial stock quantity", { exact: true }).fill("9");
  await page.getByLabel("Low stock threshold", { exact: true }).fill("3");
  await page.getByLabel("Featured", { exact: true }).check();
  await page.getByLabel("SEO title", { exact: true }).fill(`Test SEO ${suffix}`);
  await page
    .getByLabel("SEO description", { exact: true })
    .fill("Acceptance test product description.");
  await page.getByRole("button", { name: "Create product", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/[a-f0-9]+\/edit/);
  const editUrl = page.url();
  const api = process.env.E2E_API_ORIGIN!;
  const draftInMongo = productInMongo(slug);
  expect(draftInMongo).not.toBeNull();
  if (!draftInMongo) throw new Error("New admin product was not persisted to MongoDB.");
  expect(draftInMongo).toMatchObject({
    audience: "men",
    media: [],
    publishedAt: null,
    status: "draft",
  });
  expect(draftInMongo.categoryIds).toHaveLength(1);
  expect(draftInMongo.collectionIds).toHaveLength(1);
  expect(draftInMongo.variants).toEqual([
    expect.objectContaining({
      salePricePaise: 80_000,
      size: "M",
      sku: `VERIFY-${suffix}-M`,
      status: "active",
      stockOnHand: 9,
    }),
  ]);
  expect((await request.get(`${api}/api/v1/catalog/products/${slug}`)).status()).toBe(404);
  await page.reload();
  await expect(page.getByLabel("Material", { exact: true })).toHaveValue("Cotton");
  await expect(page.getByLabel("Featured", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Low stock threshold", { exact: true })).toHaveValue("3");
  await page.getByLabel("Product status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Add variant", exact: true }).click();
  await page.getByLabel("SKU", { exact: true }).nth(1).fill(`VERIFY-${suffix}-L`);
  await page.getByLabel("Colour", { exact: true }).nth(1).fill("Black");
  await page.getByLabel("Size", { exact: true }).nth(1).fill("L");
  await page.getByLabel("MRP (₹)", { exact: true }).nth(1).fill("1000");
  await page.getByLabel("Sale price (₹)", { exact: true }).nth(1).fill("750");
  await page.getByLabel("Weight (grams)", { exact: true }).nth(1).fill("260");
  await page.getByLabel("Initial stock quantity", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved" })).toBeVisible();
  const response = await request.get(`${api}/api/v1/catalog/products/${slug}`);
  expect(response.ok()).toBe(true);
  const { data } = await response.json();
  expect(data.audience).toBe("men");
  expect(data.categoryIds).toEqual(draftInMongo.categoryIds);
  expect(data.collectionIds).toEqual(draftInMongo.collectionIds);
  expect(data.variants).toHaveLength(2);
  expect(
    data.variants.map((variant: { availableStock: number }) => variant.availableStock).sort(),
  ).toEqual([4, 9]);
  expect(data.ratingCount).toBe(0);
  const adminApi = await playwrightRequest.newContext({
    baseURL: api,
    extraHTTPHeaders: { origin: process.env.E2E_WEB_ORIGIN! },
  });
  try {
    const login = await adminApi.post("/api/v1/auth/login", { data: admin });
    expect(login.ok()).toBe(true);
    const loginBody = (await login.json()) as { readonly data: { readonly accessToken: string } };
    const attachMedia = await adminApi.post(`/api/v1/admin/products/${data.id}/media`, {
      data: {
        alt: mediaAlt,
        bytes: 500_000,
        format: "webp",
        height: 1500,
        mimeType: "image/webp",
        primary: true,
        publicId: mediaPublicId,
        secureUrl: mediaSecureUrl,
        width: 1200,
      },
      headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    expect(attachMedia.status()).toBe(201);
  } finally {
    await adminApi.dispose();
  }
  const mediaResponse = await request.get(`${api}/api/v1/catalog/products/${slug}`);
  expect(mediaResponse.ok()).toBe(true);
  const { data: mediaData } = await mediaResponse.json();
  expect(mediaData.primaryImage).toMatchObject({ alt: mediaAlt, secureUrl: mediaSecureUrl });
  expect(mediaData.media).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ alt: mediaAlt, primary: true, secureUrl: mediaSecureUrl }),
    ]),
  );
  const activeInMongo = productInMongo(slug);
  expect(activeInMongo).not.toBeNull();
  if (!activeInMongo) throw new Error("Published admin product was not found in MongoDB.");
  expect(activeInMongo).toMatchObject({ audience: "men", status: "active" });
  expect(activeInMongo.publishedAt).not.toBeNull();
  expect(activeInMongo.media).toEqual([
    expect.objectContaining({
      alt: mediaAlt,
      primary: true,
      publicId: mediaPublicId,
      secureUrl: mediaSecureUrl,
    }),
  ]);
  expect(activeInMongo.variants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        salePricePaise: 80_000,
        size: "M",
        stockOnHand: 9,
      }),
      expect.objectContaining({
        salePricePaise: 75_000,
        size: "L",
        stockOnHand: 4,
      }),
    ]),
  );
  await page.goto("/");
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto("/men");
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/category/${categorySlug}?audience=men`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/collection/test-collection-${suffix}`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: `${name}, available`, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: mediaAlt, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`Test SEO ${suffix}`));
  await page.goto(editUrl);
  await page.getByLabel("Sale price (₹)", { exact: true }).first().fill("700");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved" })).toBeVisible();
  await page.goto("/admin/inventory");
  await page.getByLabel("Search inventory", { exact: true }).fill(`VERIFY-${suffix}-M`);
  const inventoryRow = page.getByRole("row", { name: new RegExp(`VERIFY-${suffix}-M`) });
  await expect(inventoryRow).toBeVisible();
  const promptResponses = ["-4", "E2E catalogue stock adjustment"];
  const acceptInventoryPrompts = (dialog: { accept(value?: string): Promise<void> }) => {
    void dialog.accept(promptResponses.shift());
  };
  page.on("dialog", acceptInventoryPrompts);
  try {
    await inventoryRow.getByRole("button", { name: "Adjust", exact: true }).click();
    await expect(inventoryRow.getByText("5 available", { exact: true })).toBeVisible();
  } finally {
    page.off("dialog", acceptInventoryPrompts);
  }
  const updatedResponse = await request.get(`${api}/api/v1/catalog/products/${slug}`);
  expect(updatedResponse.ok()).toBe(true);
  const { data: updatedData } = await updatedResponse.json();
  expect(updatedData.minSalePricePaise).toBe(70_000);
  expect(updatedData.variants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        salePricePaise: 70_000,
        size: "M",
        availableStock: 5,
      }),
    ]),
  );
  const updatedInMongo = productInMongo(slug);
  expect(updatedInMongo).not.toBeNull();
  if (!updatedInMongo) throw new Error("Updated admin product was not found in MongoDB.");
  expect(updatedInMongo.variants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ salePricePaise: 70_000, size: "M", stockOnHand: 5 }),
    ]),
  );
  await page.goto("/men");
  const updatedProductLink = page.getByRole("link", { name: `${name}, available`, exact: true });
  await expect(updatedProductLink).toBeVisible();
  await expect(updatedProductLink.getByText("₹700.00", { exact: true })).toBeVisible();
  await updatedProductLink.click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await expect(page.getByText("₹700.00", { exact: true })).toBeVisible();
  await expect(page.getByText("5 available", { exact: true })).toBeVisible();
  await page.goto(editUrl);
  await page.getByLabel("Product status", { exact: true }).selectOption("archived");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved" })).toBeVisible();
  expect((await request.get(`${api}/api/v1/catalog/products/${slug}`)).status()).toBe(404);
  const archivedList = await request.get(
    `${api}/api/v1/catalog/products?audience=men&category=${categorySlug}&search=${encodeURIComponent(name)}`,
  );
  expect(archivedList.ok()).toBe(true);
  const { data: archivedPage } = await archivedList.json();
  expect(archivedPage.items.map((product: { slug: string }) => product.slug)).not.toContain(slug);
  const archivedInMongo = productInMongo(slug);
  expect(archivedInMongo).toMatchObject({ status: "archived" });
  await page.goto("/men");
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toHaveCount(0);
  await page.goto(`/category/${categorySlug}?audience=men`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toHaveCount(0);
  await page.goto(`/shop/${slug}`);
  await expect(
    page.getByRole("heading", { name: "This page is no longer available", exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("customer cannot enter product administration", async ({ page }) => {
  const { customer } = await readRuntime();
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("This account does not have admin access.");
  await expect(page).toHaveURL(/\/admin\/login/);
});
