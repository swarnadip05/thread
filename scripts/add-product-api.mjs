#!/usr/bin/env node
/**
 * Add products to THREAD via the Admin API
 *
 * Usage:
 *   node scripts/add-product-api.mjs --email=admin@threadstore.in --password=Secret12345 --file=scripts/products-template.json
 *
 * Options:
 *   --url=<api_base_url>       Default: https://www.threadstore.in
 *   --email=<admin_email>      Required: Admin email address
 *   --password=<admin_pwd>     Required: Admin password
 *   --file=<path_to_json>      Default: scripts/products-template.json
 */

import fs from "node:fs";
import path from "node:path";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: process.env.API_URL || "https://www.threadstore.in",
    email: process.env.ADMIN_EMAIL || "",
    password: process.env.ADMIN_PASSWORD || "",
    file: "scripts/products-template.json",
  };

  for (const arg of args) {
    if (arg.startsWith("--url=")) options.url = arg.split("=")[1].replace(/\/+$/, "");
    if (arg.startsWith("--email=")) options.email = arg.split("=")[1];
    if (arg.startsWith("--password=")) options.password = arg.split("=")[1];
    if (arg.startsWith("--file=")) options.file = arg.split("=")[1];
  }

  return options;
}

async function main() {
  const options = parseArgs();

  if (!options.email || !options.password) {
    console.error("❌ Error: --email and --password are required.");
    console.error("Usage:");
    console.error(
      "  node scripts/add-product-api.mjs --email=admin@threadstore.in --password=YourPassword [--file=path/to/products.json]",
    );
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), options.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: Product file not found at ${filePath}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(`📦 Loaded ${products.length} product(s) from ${options.file}`);
  console.log(`🌐 Connecting to: ${options.url}`);

  // 1. Authenticate as Admin
  console.log(`🔑 Authenticating as ${options.email}...`);
  const loginRes = await fetch(`${options.url}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: options.email, password: options.password }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    console.error("❌ Authentication failed:", loginData.error?.message || loginRes.statusText);
    process.exit(1);
  }

  const accessToken = loginData.data.tokens.accessToken;
  const userRoles = loginData.data.user.roles || [];
  console.log(`✅ Authenticated successfully! User roles: [${userRoles.join(", ")}]`);

  if (!userRoles.some((r) => ["super_admin", "admin", "catalog_manager"].includes(r))) {
    console.error("❌ Access denied: Account does not have admin/catalog_manager privileges.");
    process.exit(1);
  }

  // 2. Fetch categories to map category slugs to ObjectIds
  console.log("📂 Fetching categories...");
  const catRes = await fetch(`${options.url}/api/v1/catalog/products/facets`);
  try {
    const catData = await catRes.json();
    if (catData.data?.categories) {
      // categories fetched if needed for slug matching
    }
  } catch {
    // optional
  }

  // 3. Post each product to Admin API
  let successCount = 0;
  for (const item of products) {
    const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sizes = item.sizes || ["S", "M", "L", "XL", "XXL"];
    const mrpPaise = Math.round(item.mrp * 100);
    const salePricePaise = Math.round(item.salePrice * 100);
    const skuStem = slug.toUpperCase().replace(/-/g, "").slice(0, 8);

    const payload = {
      title: item.title,
      slug,
      shortDescription: item.shortDescription || `${item.title} by THREAD`,
      descriptionHtml: item.descriptionHtml || `<p>${item.title}</p>`,
      categoryIds: [],
      collectionIds: [],
      audience: item.audience || "unisex",
      brand: item.brand || "THREAD",
      tags: item.tags || ["streetwear", "cotton"],
      fit: item.fit || "Regular",
      material: "100% Combed Cotton",
      care: [
        "Machine wash cold inside out with similar colours.",
        "Hang dry or tumble dry low.",
        "Do not iron directly over print.",
      ],
      featured: Boolean(item.featured),
      newArrival: Boolean(item.newArrival),
      status: "active",
      seo: {
        title: `${item.title} | THREAD`,
        description: item.shortDescription,
        noIndex: false,
      },
      variants: sizes.map((size) => ({
        sku: `TH-${skuStem}-${size}`,
        colour: item.colour || "Standard",
        colourHex: item.colourHex || "#111111",
        size,
        attributes: {
          fit: item.fit || "Regular",
          gsm: String(item.fabricWeightGsm || 200),
        },
        mrpPaise,
        salePricePaise,
        initialStock: item.stockPerSize || 50,
        reorderLevel: 5,
        weightGrams: 250,
        status: "active",
      })),
    };

    const res = await fetch(`${options.url}/api/v1/admin/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const resData = await res.json();
    if (res.ok && resData.success) {
      successCount++;
      console.log(
        `  ✓ [${successCount}/${products.length}] Created product: "${item.title}" (${slug})`,
      );
    } else {
      console.warn(
        `  ⚠️ Could not create "${item.title}":`,
        resData.error?.message || JSON.stringify(resData),
      );
    }
  }

  console.log("\n========================================================");
  console.log(`🎉 Finished! Successfully added ${successCount} products via Admin API.`);
  console.log(`View them at: ${options.url}/admin/products`);
  console.log("========================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
