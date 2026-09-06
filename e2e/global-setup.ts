import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { request, type FullConfig } from "@playwright/test";

interface SessionResponse {
  readonly success: true;
  readonly data: {
    readonly accessToken: string;
  };
}

interface ProductResponse {
  readonly success: true;
  readonly data: {
    readonly slug: string;
    readonly variants: readonly { readonly id: string; readonly availableStock: number }[];
  };
}

function runApiScript(script: string, extraEnvironment: NodeJS.ProcessEnv): void {
  execFileSync("pnpm", ["--filter", "@thread/api", script], {
    env: { ...process.env, ...extraEnvironment },
    stdio: "inherit",
  });
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const apiOrigin = process.env.E2E_API_ORIGIN!;
  const webOrigin = process.env.E2E_WEB_ORIGIN!;
  const mongodbUri = process.env.E2E_MONGODB_URI!;
  const admin = {
    email: `e2e.admin.${Date.now()}@example.test`,
    password: `E2eBootstrap-${randomBytes(12).toString("hex")}A1`,
  };
  const updatedAdminPassword = `E2eUpdated-${randomBytes(12).toString("hex")}A1`;
  const customer = {
    email: `e2e.customer.${Date.now()}@example.test`,
    password: `E2eCustomer-${randomBytes(12).toString("hex")}A1`,
  };
  const commonEnvironment = {
    MONGODB_URI: mongodbUri,
    NODE_ENV: "test",
  };

  runApiScript("seed:e2e-reset", {
    ...commonEnvironment,
    E2E_RESET_CONFIRM: "RESET_THREAD_E2E",
  });
  runApiScript("seed:demo", {
    ...commonEnvironment,
    DEMO_SEED_CONFIRM: "SEED_THREAD_DEMO",
  });
  const bootstrapEnvironment = {
    ...commonEnvironment,
    ADMIN_BOOTSTRAP_CONFIRM: "CREATE_THREAD_SUPER_ADMIN",
    ADMIN_BOOTSTRAP_EMAIL: admin.email,
    ADMIN_BOOTSTRAP_NAME: "THREAD E2E Administrator",
    ADMIN_BOOTSTRAP_PASSWORD: admin.password,
  };
  runApiScript("bootstrap:admin", bootstrapEnvironment);
  runApiScript("bootstrap:admin", bootstrapEnvironment);

  const customerRequest = await request.newContext({
    baseURL: apiOrigin,
    extraHTTPHeaders: { origin: webOrigin },
  });
  const register = await customerRequest.post("/api/v1/auth/register", {
    data: { name: "THREAD E2E Customer", ...customer },
  });
  if (!register.ok()) throw new Error(`E2E customer registration failed: ${await register.text()}`);
  await mkdir(".e2e", { recursive: true });
  await customerRequest.storageState({ path: ".e2e/customer.json" });

  const adminRequest = await request.newContext({
    baseURL: apiOrigin,
    extraHTTPHeaders: { origin: webOrigin },
  });
  const login = await adminRequest.post("/api/v1/auth/login", { data: admin });
  if (!login.ok()) throw new Error(`E2E admin login failed: ${await login.text()}`);
  const loginBody = (await login.json()) as SessionResponse;
  const change = await adminRequest.post("/api/v1/auth/change-password", {
    data: { currentPassword: admin.password, newPassword: updatedAdminPassword },
    headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
  });
  if (!change.ok()) throw new Error(`E2E admin password change failed: ${await change.text()}`);
  const relogin = await adminRequest.post("/api/v1/auth/login", {
    data: { email: admin.email, password: updatedAdminPassword },
  });
  if (!relogin.ok()) throw new Error(`E2E admin re-login failed: ${await relogin.text()}`);
  await adminRequest.storageState({ path: ".e2e/admin.json" });

  const catalogue = await customerRequest.get(
    "/api/v1/catalog/products?limit=1&availability=in_stock",
  );
  const catalogueBody = (await catalogue.json()) as { data: { items: { slug: string }[] } };
  const firstSlug = catalogueBody.data?.items[0]?.slug;
  if (!firstSlug) throw new Error("Demo seed did not produce visible products.");
  const product = await customerRequest.get(`/api/v1/catalog/products/${firstSlug}`);
  if (!product.ok()) throw new Error(`E2E demo product lookup failed: ${await product.text()}`);
  const productBody = (await product.json()) as ProductResponse;
  const variant = productBody.data.variants.find((item) => item.availableStock > 0);
  if (!variant) throw new Error("E2E demo product has no available variant.");
  await writeFile(
    ".e2e/runtime.json",
    JSON.stringify(
      {
        admin: { email: admin.email, password: updatedAdminPassword },
        customer,
        productSlug: productBody.data.slug,
        variantId: variant.id,
      },
      null,
      2,
    ),
  );

  await Promise.all([customerRequest.dispose(), adminRequest.dispose()]);
}
