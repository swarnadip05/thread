import { expect, test } from "@playwright/test";

import { readRuntime } from "./runtime.js";

test("desktop public visual baselines", async ({ page }) => {
  const runtime = await readRuntime();
  for (const [name, route] of [
    ["homepage", "/"],
    ["plp", "/men"],
    ["pdp", `/shop/${runtime.productSlug}`],
  ] as const) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    if (name === "homepage")
      await expect(page.locator("header").first()).toHaveScreenshot("desktop-header.png");
    await expect(page).toHaveScreenshot(`desktop-${name}.png`, { fullPage: true });
  }
});

test("desktop checkout and admin visual baselines", async ({ browser }) => {
  const runtime = await readRuntime();
  const customer = await browser.newContext({
    storageState: ".e2e/customer.json",
    viewport: { width: 1440, height: 1000 },
  });
  const checkout = await customer.newPage();
  await checkout.addInitScript(
    ({ productSlug, variantId }) =>
      localStorage.setItem(
        "thread:cart:v1",
        JSON.stringify([
          {
            productId: "server-reloads-product",
            slug: productSlug,
            title: "[DEMO] Ink Oversized Tee",
            variantId,
            quantity: 1,
            observedUnitPricePaise: 79_900,
          },
        ]),
      ),
    { productSlug: runtime.productSlug, variantId: runtime.variantId },
  );
  await checkout.goto("/checkout");
  await expect(
    checkout.getByRole("heading", { name: "Confirm delivery and totals" }),
  ).toBeVisible();
  await expect(checkout).toHaveScreenshot("desktop-checkout.png", { fullPage: true });

  const admin = await browser.newContext({
    storageState: ".e2e/admin.json",
    viewport: { width: 1440, height: 1000 },
  });
  const dashboard = await admin.newPage();
  await dashboard.goto("/admin");
  await expect(dashboard.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(dashboard).toHaveScreenshot("desktop-admin-dashboard.png", { fullPage: true });
  await Promise.all([customer.close(), admin.close()]);
});
