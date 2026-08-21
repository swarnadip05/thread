import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { readRuntime } from "./runtime.js";

test("mobile navigation is keyboard/touch accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open category menu" }).click();
  await expect(page.getByRole("dialog", { name: "Shop categories" })).toBeVisible();
  await page.getByRole("button", { name: "MEN" }).click();
  await expect(page.getByRole("link", { name: "T-Shirts", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Shop categories" })).toBeHidden();
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);
});

test("mobile visual baselines", async ({ page }) => {
  const runtime = await readRuntime();
  for (const [name, route] of [
    ["homepage", "/"],
    ["plp", "/men"],
    ["pdp", `/shop/${runtime.productSlug}`],
  ] as const) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page).toHaveScreenshot(`mobile-${name}.png`, { fullPage: true });
  }
});
