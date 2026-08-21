import { expect, test } from "@playwright/test";

test("the deployed storefront responds without insecure resources", async ({ page }) => {
  const insecureRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("http://")) insecureRequests.push(request.url());
  });

  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page.locator("body")).toContainText("THREAD");
  expect(insecureRequests).toEqual([]);
});
