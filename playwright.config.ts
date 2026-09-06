import { randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const webOrigin = process.env.E2E_WEB_ORIGIN || "http://127.0.0.1:3000";
const apiOrigin = process.env.E2E_API_ORIGIN || "http://127.0.0.1:4000";
const mongodbUri =
  process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:27017/thread_commerce_e2e?replicaSet=rs0";

process.env.E2E_WEB_ORIGIN = webOrigin;
process.env.E2E_API_ORIGIN = apiOrigin;
process.env.E2E_MONGODB_URI = mongodbUri;
process.env.E2E_ACCESS_TOKEN_SECRET ||= randomBytes(48).toString("hex");
process.env.E2E_PRODUCT_PREVIEW_SECRET ||= randomBytes(48).toString("hex");

const apiEnvironment = {
  ACCESS_TOKEN_AUDIENCE: "thread-e2e-web",
  ACCESS_TOKEN_ISSUER: "thread-e2e-api",
  ACCESS_TOKEN_SECRET: process.env.E2E_ACCESS_TOKEN_SECRET,
  CORS_ORIGINS: webOrigin,
  EMAIL_PROVIDER: "local",
  HOST: "127.0.0.1",
  LOG_LEVEL: "warn",
  MAX_CART_QUANTITY: "10",
  MONGODB_URI: mongodbUri,
  NODE_ENV: "test",
  PAYMENT_PROVIDER: "mock",
  PORT: new URL(apiOrigin).port,
  PRODUCT_PREVIEW_SECRET: process.env.E2E_PRODUCT_PREVIEW_SECRET,
  REDIS_URL: process.env.E2E_REDIS_URL || "redis://127.0.0.1:6379",
  SOCKET_REDIS_ADAPTER_ENABLED: "false",
  WEB_ORIGIN: webOrigin,
};

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(process.env.E2E_BROWSER_EXECUTABLE
      ? { launchOptions: { executablePath: process.env.E2E_BROWSER_EXECUTABLE } }
      : {}),
    video: process.env.E2E_BROWSER_EXECUTABLE ? "off" : "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    },
  },
  projects: [
    {
      name: "chromium-desktop",
      testIgnore: /mobile-and-visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "chromium-mobile",
      testMatch: /mobile-and-visual\.spec\.ts/,
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @thread/api dev",
      env: apiEnvironment,
      reuseExistingServer: process.env.E2E_REUSE_SERVERS === "true",
      timeout: 120_000,
      url: `${apiOrigin}/health/ready`,
    },
    {
      command: `pnpm --filter @thread/web exec next dev --port ${new URL(webOrigin).port}`,
      env: {
        E2E_NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SOCKET_URL: apiOrigin,
        NEXT_PUBLIC_API_URL: apiOrigin,
        NEXT_PUBLIC_SITE_URL: webOrigin,
      },
      reuseExistingServer: process.env.E2E_REUSE_SERVERS === "true",
      timeout: 120_000,
      url: webOrigin,
    },
  ],
});
