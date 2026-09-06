import { expect, test } from "@playwright/test";
import { readRuntime } from "./runtime";

test("admin creates, edits, publishes and archives a product visible across the storefront", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const { admin } = await readRuntime();
  const suffix = Date.now().toString();
  const name = `Verification tee ${suffix}`;
  const slug = `verification-tee-${suffix}`;
  const category = `Test category ${suffix}`;
  const collection = `Test collection ${suffix}`;
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
  expect(data.variants).toHaveLength(2);
  expect(
    data.variants.map((variant: { availableStock: number }) => variant.availableStock).sort(),
  ).toEqual([4, 9]);
  expect(data.ratingCount).toBe(0);
  await page.goto("/");
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/category/test-category-${suffix}`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/collection/test-collection-${suffix}`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name: `${name}, available`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: `${name}, available`, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`Test SEO ${suffix}`));
  await page.goto(editUrl);
  await page.getByLabel("Product status", { exact: true }).selectOption("archived");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved" })).toBeVisible();
  expect((await request.get(`${api}/api/v1/catalog/products/${slug}`)).status()).toBe(404);
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
