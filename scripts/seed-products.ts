import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type mongoose from "mongoose";
import pino from "pino";
import { clientProductAssets, type ClientImageAsset, type ClientProductAsset } from "@thread/types";

import { connectDatabase, disconnectDatabase } from "../apps/api/src/database/connection.js";
import { CategoryModel } from "../apps/api/src/models/category.model.js";
import { CollectionModel } from "../apps/api/src/catalogue/models/collection.model.js";
import { ProductModel } from "../apps/api/src/catalogue/models/product.model.js";
import { ProductVariantModel } from "../apps/api/src/catalogue/models/product-variant.model.js";
import { ShippingMethodModel } from "../apps/api/src/checkout/models/shipping-method.model.js";
import { runSeedMigrations } from "../apps/api/src/seeds/migrations.js";

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
  },
});

interface CustomProductInput {
  title: string;
  slug?: string;
  shortDescription?: string;
  descriptionHtml?: string;
  categorySlug: string;
  audience: "men" | "women" | "unisex" | "accessories";
  brand?: string;
  fit?: string;
  fabricWeightGsm?: number;
  tags?: string[];
  featured?: boolean;
  newArrival?: boolean;
  mrp: number; // in Rupees
  salePrice: number; // in Rupees
  colour?: string;
  colourHex?: string;
  sizes?: string[];
  stockPerSize?: number;
  images?: Array<{ src: string; alt?: string; width?: number; height?: number }>;
}

const defaultCare = [
  "Wash inside out in cold water with similar colours.",
  "Hang dry or tumble dry on low heat.",
  "Do not iron directly over the graphic print.",
  "Do not use chlorine bleach.",
];

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedProducts(customProductsPath?: string): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Pass it via .env or specify: MONGODB_URI='your-mongo-uri' npx tsx scripts/seed-products.ts",
    );
  }

  logger.info("Connecting to MongoDB database...");
  await connectDatabase(uri, logger);

  try {
    // 1. Ensure core schema migrations and categories exist
    logger.info("Ensuring core categories, collections and settings are migrated...");
    await runSeedMigrations();

    // 2. Fetch categories map
    const categories = await CategoryModel.find({}).lean();
    const categoryMap = new Map<string, mongoose.Types.ObjectId>(
      categories.map((c) => [c.slug, c._id as mongoose.Types.ObjectId]),
    );

    // Ensure fallback categories exist if not already in DB
    const requiredCategories = [
      { name: "Oversized T-Shirts", slug: "oversized-t-shirts", audience: "men" as const },
      { name: "Classic Fit T-Shirts", slug: "classic-fit-t-shirts", audience: "unisex" as const },
      { name: "T-Shirts", slug: "t-shirts", audience: "unisex" as const },
    ];

    for (const cat of requiredCategories) {
      if (!categoryMap.has(cat.slug)) {
        const doc = await CategoryModel.findOneAndUpdate(
          { slug: cat.slug },
          {
            $setOnInsert: {
              name: cat.name,
              slug: cat.slug,
              audience: cat.audience,
              active: true,
              sortOrder: 10,
            },
          },
          { upsert: true, new: true },
        ).lean();
        categoryMap.set(cat.slug, doc._id as mongoose.Types.ObjectId);
        logger.info(`Created missing category: ${cat.name} (${cat.slug})`);
      }
    }

    // 3. Ensure a featured Collection exists
    const collection = await CollectionModel.findOneAndUpdate(
      { slug: "signature-collection" },
      {
        $setOnInsert: {
          name: "Signature Collection",
          slug: "signature-collection",
          description: "Curated streetwear and daily essentials from THREAD.",
          active: true,
        },
      },
      { upsert: true, new: true },
    ).lean();

    // 4. Ensure at least one active shipping method exists so checkout works seamlessly
    await ShippingMethodModel.findOneAndUpdate(
      { name: "Standard Delivery" },
      {
        $setOnInsert: {
          name: "Standard Delivery",
          description: "Standard doorstep delivery across India.",
          ratePaise: 0, // Free delivery
          freeShippingThresholdPaise: 0,
          estimatedBusinessDaysMin: 3,
          estimatedBusinessDaysMax: 6,
          countries: ["India"],
          postalPrefixes: [],
          codEligible: true,
          active: true,
          sortOrder: 1,
        },
      },
      { upsert: true },
    );

    // 5. Determine which products to seed
    let productsToSeed: CustomProductInput[] = [];

    if (customProductsPath) {
      const resolvedPath = path.resolve(process.cwd(), customProductsPath);
      logger.info(`Reading custom product catalog from: ${resolvedPath}`);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Specified product JSON file does not exist: ${resolvedPath}`);
      }
      const raw = fs.readFileSync(resolvedPath, "utf-8");
      productsToSeed = JSON.parse(raw);
    } else {
      logger.info(
        "No custom JSON specified. Preparing client product catalogue from approved assets...",
      );

      // Map all available client product assets into full product listings
      const sizes = ["S", "M", "L", "XL", "XXL"];

      productsToSeed = clientProductAssets.map((asset: ClientProductAsset, index: number) => {
        const isOversized = asset.fit === "Oversized";
        const cleanTitle = asset.title.replace(/^\[DEMO\]\s*/i, "").trim();
        const mrp = isOversized ? 899 : 799;
        const salePrice = isOversized ? 649 : 549;

        return {
          title: cleanTitle,
          slug: asset.slug.replace(/^demo-/i, ""),
          shortDescription: `${asset.fit} fit ${asset.audience}'s t-shirt crafted from premium combed cotton with durable graphics.`,
          descriptionHtml: `<p>Elevate your daily streetwear rotation with the THREAD ${cleanTitle}. Tailored with a comfortable ${asset.fit.toLowerCase()} cut and durable double-needle stitching.</p><ul><li>Premium 100% Combed Cotton</li><li>High-density DTF / Screen artwork</li><li>Pre-shrunk fabric to minimize shrinkage</li><li>Designed in Kolkata by SNAP CART</li></ul>`,
          categorySlug: asset.categorySlug || (isOversized ? "oversized-t-shirts" : "t-shirts"),
          audience: asset.audience,
          brand: "THREAD",
          fit: asset.fit,
          fabricWeightGsm: isOversized ? 240 : 180,
          tags: [asset.fit.toLowerCase(), asset.audience, "cotton", "streetwear", "best-seller"],
          featured: index < 8,
          newArrival: true,
          mrp,
          salePrice,
          colour: asset.audience === "women" ? "Vintage Cream" : "Onyx Black",
          colourHex: asset.audience === "women" ? "#F5F2EB" : "#1A1A1A",
          sizes,
          stockPerSize: 50,
          images: asset.images.map((img: ClientImageAsset) => ({
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height,
          })),
        };
      });
    }

    logger.info(`Processing ${productsToSeed.length} products into the catalogue...`);

    let seededCount = 0;

    for (const item of productsToSeed) {
      const slug = item.slug || generateSlug(item.title);
      const categoryId = categoryMap.get(item.categorySlug) || categoryMap.get("t-shirts")!;
      const sizes = item.sizes || ["S", "M", "L", "XL", "XXL"];
      const stockPerSize = item.stockPerSize ?? 50;
      const skuStem = slug.toUpperCase().replace(/-/g, "").slice(0, 10);

      // Create or update the product document
      const product = await ProductModel.findOneAndUpdate(
        { slug },
        {
          $set: {
            title: item.title,
            shortDescription: item.shortDescription || `${item.title} by THREAD`,
            descriptionHtml: item.descriptionHtml || `<p>${item.title} by THREAD</p>`,
            categoryIds: [categoryId],
            collectionIds: collection ? [collection._id] : [],
            audience: item.audience,
            brand: item.brand || "THREAD",
            tags: item.tags || ["streetwear", "cotton"],
            fit: item.fit || "Regular",
            material: "100% Combed Cotton",
            care: defaultCare,
            status: "active",
            featured: Boolean(item.featured),
            newArrival: Boolean(item.newArrival),
            seo: {
              title: `${item.title} | THREAD`,
              description: item.shortDescription || `Shop ${item.title} online at THREAD.`,
              noIndex: false,
            },
            publishedAt: new Date(),
            media: (item.images || []).map((img, i) => ({
              publicId: `thread/products/${slug}/img-${i + 1}`,
              secureUrl: img.src,
              width: img.width || 1000,
              height: img.height || 1000,
              format: "jpg",
              mimeType: "image/jpeg",
              bytes: 120000,
              alt: img.alt || `${item.title} - Image ${i + 1}`,
              sortOrder: i,
              primary: i === 0,
            })),
          },
          $setOnInsert: {
            slug,
            previousSlugs: [],
            rating: { average: 5, count: 1 },
          },
        },
        { upsert: true, new: true, runValidators: true },
      ).lean();

      // Create/update variants for each size
      for (const size of sizes) {
        const sku = `TH-${skuStem}-${size}`;
        const mrpPaise = Math.round(item.mrp * 100);
        const salePricePaise = Math.round(item.salePrice * 100);

        await ProductVariantModel.findOneAndUpdate(
          { sku },
          {
            $set: {
              colour: item.colour || "Standard",
              colourHex: item.colourHex || "#000000",
              attributes: {
                fit: item.fit || "Regular",
                fabric: "100% Cotton",
                gsm: String(item.fabricWeightGsm || 200),
              },
              mrpPaise,
              salePricePaise,
              status: "active",
            },
            $setOnInsert: {
              productId: product._id,
              sku,
              size,
              stockOnHand: stockPerSize,
              stockReserved: 0,
              reorderLevel: 5,
              weightGrams: 250,
            },
          },
          { upsert: true, runValidators: true },
        );
      }

      seededCount++;
      logger.info(
        `✓ [${seededCount}/${productsToSeed.length}] Added product: ${item.title} (${slug}) - Sizes: ${sizes.join(", ")}`,
      );
    }

    logger.info("");
    logger.info("==========================================================");
    logger.info(`🎉 SUCCESS: ${seededCount} products successfully added/updated!`);
    logger.info("All products are marked ACTIVE and are now live on:");
    logger.info("1. Admin Dashboard: https://www.threadstore.in/admin/products");
    logger.info("2. Storefront: https://www.threadstore.in/");
    logger.info("==========================================================");
  } finally {
    await disconnectDatabase(logger);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith("--file="));
const customFile = fileArg ? fileArg.split("=")[1] : undefined;

seedProducts(customFile).catch((error) => {
  logger.error({ err: error }, "Failed to seed products into catalogue.");
  process.exit(1);
});
