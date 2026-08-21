import { randomUUID } from "node:crypto";

import { expect, request, test } from "@playwright/test";

import { readRuntime } from "./runtime.js";

test("mock checkout appears for customer and admin, then updates live", async ({ browser }) => {
  const runtime = await readRuntime();
  const customerContext = await browser.newContext({ storageState: ".e2e/customer.json" });
  const customerPage = await customerContext.newPage();
  await customerPage.addInitScript(
    ({ productSlug, variantId }) => {
      localStorage.setItem(
        "thread:cart:v1",
        JSON.stringify([
          {
            productId: "server-reloads-product",
            slug: productSlug,
            title: "[DEMO] Ink Oversized Tee",
            variantId,
            quantity: 1,
            observedUnitPricePaise: 1,
          },
        ]),
      );
    },
    { productSlug: runtime.productSlug, variantId: runtime.variantId },
  );
  await customerPage.goto("/checkout");
  await expect(
    customerPage.getByRole("heading", { name: "Confirm delivery and totals" }),
  ).toBeVisible();
  await customerPage.getByRole("button", { name: "Add address" }).click();
  await customerPage.getByLabel("Full name").fill("THREAD E2E Customer");
  await customerPage.getByLabel("Phone").fill("+919073661067");
  await customerPage.getByLabel("Address line 1").fill("AB01 ADHARSHAPALLY ROAD");
  await customerPage.getByLabel("City").fill("KOLKATA");
  await customerPage.getByLabel("District").fill("NORTH 24 PARGANAS");
  await customerPage.getByLabel("State").fill("WEST BENGAL");
  await customerPage.getByLabel("Postal code").fill("700159");
  await customerPage.getByRole("button", { name: "Save address" }).click();
  await expect(customerPage.getByText("[DEMO] Standard delivery")).toBeVisible();
  await customerPage
    .getByText(/I acknowledge the shipping, returns and order-cancellation policies/)
    .click();
  await customerPage.getByRole("button", { name: "Reserve stock and continue" }).click();
  await expect(customerPage.getByRole("heading", { name: "Stock reserved" })).toBeVisible();
  await expect(customerPage.getByText("Price updated from the cart value.")).toBeVisible();
  await customerPage.getByRole("button", { name: "Pay server-confirmed total" }).click();
  await expect(customerPage).toHaveURL(/\/checkout\/payment\//);
  await expect(customerPage.getByText("Payment verified")).toBeVisible();
  const orderNumber = (await customerPage.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(orderNumber).toMatch(/^THR-\d{4}-\d{6}$/);

  await customerPage.goto("/account/orders");
  await expect(customerPage.getByText(orderNumber)).toBeVisible();
  const trackingHref = await customerPage
    .getByRole("link", { name: "View tracking" })
    .getAttribute("href");
  const orderId = trackingHref?.split("/").at(-1);
  expect(orderId).toMatch(/^[a-f0-9]{24}$/);

  const api = await request.newContext({
    baseURL: process.env.E2E_API_ORIGIN!,
    extraHTTPHeaders: { origin: process.env.E2E_WEB_ORIGIN! },
  });
  const intruderCredentials = {
    email: `intruder.${randomUUID()}@example.test`,
    password: "OrderIsolationA1",
  };
  const intruderRegistration = await api.post("/api/v1/auth/register", {
    data: { name: "Order Isolation Customer", ...intruderCredentials },
  });
  const intruderSession = (await intruderRegistration.json()) as {
    readonly data: { readonly accessToken: string };
  };
  const isolatedOrder = await api.get(`/api/v1/orders/${orderId}/tracking`, {
    headers: { authorization: `Bearer ${intruderSession.data.accessToken}` },
  });
  expect(isolatedOrder.status()).toBe(404);
  const forbiddenAdmin = await api.get("/api/v1/admin/operations/orders", {
    headers: { authorization: `Bearer ${intruderSession.data.accessToken}` },
  });
  expect(forbiddenAdmin.status()).toBe(403);

  const adminContext = await browser.newContext({ storageState: ".e2e/admin.json" });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/orders");
  await expect(adminPage.getByText(orderNumber)).toBeVisible();
  await adminPage.getByRole("link", { name: "Open" }).first().click();
  await expect(adminPage.getByRole("heading", { name: orderNumber })).toBeVisible();
  adminPage.once("dialog", (dialog) => dialog.accept("Acceptance test fulfilment transition"));
  await adminPage.getByRole("button", { name: "processing" }).click();
  await expect(adminPage.getByText("processing", { exact: true }).first()).toBeVisible();

  await expect(customerPage.getByText("processing", { exact: true })).toBeVisible({
    timeout: 12_000,
  });
  await Promise.all([adminContext.close(), customerContext.close(), api.dispose()]);
});
