import { randomUUID } from "node:crypto";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { readRuntime } from "./runtime.js";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
}

test("browse, filter, product detail and wishlist", async ({ page }) => {
  const runtime = await readRuntime();
  await page.goto("/men");
  await expect(page.getByRole("heading", { level: 1, name: "Men" })).toBeVisible();
  await expect(page.getByRole("link", { name: /\[DEMO\] Ink Oversized Tee/ })).toBeVisible();

  const filters = page.getByRole("complementary", { name: "Product filters" });
  await filters.getByText("M", { exact: true }).click();
  await expect(page).toHaveURL(/size=M/);
  await page.getByRole("link", { name: /\[DEMO\] Ink Oversized Tee/ }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "[DEMO] Ink Oversized Tee" }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/shop/${runtime.productSlug}$`));
  const wishlist = page.getByRole("button", { name: "Add to wishlist" });
  await wishlist.click();
  await expect(page.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByText("Added to cart")).toBeVisible();
});

test("register and sign back in without storing tokens in localStorage", async ({ page }) => {
  const identity = {
    email: `browser.${randomUUID()}@example.test`,
    password: "BrowserAcceptanceA1",
  };
  await page.goto("/auth/register");
  await page.getByLabel("Full name").fill("Browser Acceptance Customer");
  await page.getByLabel("Email address").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.getByRole("checkbox").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: /Your THREAD account/i })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /access|refresh|token/i.test(key)),
    ),
  ).toBe(false);

  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.getByLabel("Email address").fill(identity.email);
  await page.getByLabel("Password").fill(identity.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("accessibility smoke on public discovery and product pages", async ({ page }) => {
  const runtime = await readRuntime();
  for (const route of ["/", "/men", `/shop/${runtime.productSlug}`]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  }
});
