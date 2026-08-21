import { defineConfig, devices } from "@playwright/test";

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error("PREVIEW_URL is required.");

const parsedPreviewUrl = new URL(previewUrl);
if (parsedPreviewUrl.protocol !== "https:") throw new Error("PREVIEW_URL must use HTTPS.");

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /preview-smoke\.spec\.ts/,
  outputDir: "test-results/preview",
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["github"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: parsedPreviewUrl.origin,
    extraHTTPHeaders: bypassSecret
      ? {
          "x-vercel-protection-bypass": bypassSecret,
          "x-vercel-set-bypass-cookie": "samesitenone",
        }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
