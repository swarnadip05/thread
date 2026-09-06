import mongoose, { type ClientSession } from "mongoose";
import { clientProductAssets } from "@thread/types";

import { CollectionModel } from "../catalogue/models/collection.model.js";
import { ProductVariantModel } from "../catalogue/models/product-variant.model.js";
import { ProductModel } from "../catalogue/models/product.model.js";
import { CouponModel } from "../checkout/models/coupon.model.js";
import { ShippingMethodModel } from "../checkout/models/shipping-method.model.js";
import { CategoryModel } from "../models/category.model.js";
import { SeedMigrationModel } from "../models/seed-migration.model.js";
import { SiteSettingsModel } from "../models/site-settings.model.js";

const DEMO_VERSION = "demo-2026-09-06-local-catalogue-v4";
const genericCare = [
  "Wash inside out in cold water.",
  "Hang dry or tumble dry on low heat.",
  "Never iron directly over a print.",
] as const;

const selectedAssets = [
  ...clientProductAssets.filter((asset) => asset.audience === "men").slice(0, 6),
  ...clientProductAssets.filter((asset) => asset.audience === "women").slice(0, 6),
];
const demoProducts = selectedAssets.map((asset) => {
  const oversized = asset.fit === "Oversized";
  return {
    ...asset,
    fabricWeightGsm: oversized ? 210 : 180,
    mrpPaise: oversized ? 74_900 : 69_900,
    salePricePaise: oversized ? 59_900 : asset.audience === "women" ? 59_900 : 54_900,
    title: `[DEMO] ${asset.title}`,
  };
});

const legacyDemoSlugs = [
  "demo-ink-oversized-tee",
  "demo-ivory-classic-tee",
  "demo-charcoal-relaxed-tee",
  "demo-gold-relaxed-tee",
  "demo-white-classic-tee",
  "demo-forest-oversized-tee",
] as const;

async function applyDemoSeed(session: ClientSession): Promise<void> {
  const categories = await CategoryModel.find({
    slug: { $in: [...new Set(demoProducts.map((product) => product.categorySlug))] },
  })
    .session(session)
    .lean();
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category._id]));
  if (categoryBySlug.size !== 2)
    throw new Error("Run the core seed before the demo seed so catalogue categories exist.");

  const collection = await CollectionModel.findOneAndUpdate(
    { slug: "demo-everyday-edit" },
    {
      $setOnInsert: {
        name: "[DEMO] Everyday Edit",
        slug: "demo-everyday-edit",
        active: true,
      },
    },
    { new: true, session, upsert: true },
  ).lean();

  const legacyProducts = await ProductModel.find({ slug: { $in: legacyDemoSlugs } })
    .select({ _id: 1 })
    .session(session)
    .lean();
  if (legacyProducts.length) {
    const legacyIds = legacyProducts.map((product) => product._id);
    await ProductModel.updateMany(
      { _id: { $in: legacyIds } },
      { $set: { status: "archived", featured: false } },
      { session },
    );
    await ProductVariantModel.updateMany(
      { productId: { $in: legacyIds } },
      { $set: { status: "inactive" } },
      { session },
    );
  }

  for (const demo of demoProducts) {
    const categoryId = categoryBySlug.get(demo.categorySlug)!;
    const existing = await ProductModel.findOne({ slug: demo.slug }).session(session).lean();
    if (existing && !existing.tags.includes("demo"))
      throw new Error(`Refusing to overwrite non-demo product: ${demo.slug}`);
    const conflictingSku = await ProductVariantModel.findOne({
      sku: { $in: ["S", "M", "L"].map((size) => `${demo.skuStem}-${size}`) },
      ...(existing ? { productId: { $ne: existing._id } } : {}),
    })
      .session(session)
      .lean();
    if (conflictingSku)
      throw new Error(`Demo SKU already belongs to another product: ${conflictingSku.sku}`);
    const product = await ProductModel.findOneAndUpdate(
      { slug: demo.slug },
      {
        $set: {
          title: demo.title,
          shortDescription: `[DEMO] ${demo.fit} fit. Sample catalogue data for local development.`,
          descriptionHtml: `<p>[DEMO] THREAD ${demo.fit} fit T-shirt using approved local photography. Product facts, pricing and stock are demonstration values; confirm real product details before publication.</p>`,
          categoryIds: [categoryId],
          collectionIds: [collection._id],
          audience: demo.audience,
          brand: "THREAD",
          tags: ["demo", "acceptance-test", "client-photography"],
          media: demo.images.map((image, index) => ({
            publicId: image.publicId,
            secureUrl: image.src,
            width: image.width,
            height: image.height,
            format: image.format,
            mimeType: image.mimeType,
            bytes: image.bytes,
            alt: image.alt,
            sortOrder: index,
            primary: index === 0,
          })),
          fit: demo.fit,
          material: null,
          care: genericCare,
          status: "active",
          featured: demo.styleNumber <= 8,
          newArrival: true,
          seo: {
            title: demo.title,
            description: "THREAD demonstration product using approved client photography.",
            noIndex: true,
          },
          rating: { average: 0, count: 0 },
          publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        $setOnInsert: {
          slug: demo.slug,
          previousSlugs: [],
        },
      },
      { new: true, runValidators: true, session, upsert: true },
    ).lean();

    for (const [index, size] of ["S", "M", "L"].entries()) {
      await ProductVariantModel.updateOne(
        { sku: `${demo.skuStem}-${size}` },
        {
          $set: {
            colour: "Client confirmation required",
            attributes: {
              dataType: "demo",
              fabricWeightGsm: String(demo.fabricWeightGsm),
              photography: "client-approved",
            },
            mrpPaise: demo.mrpPaise,
            salePricePaise: demo.salePricePaise,
            imagePublicIds: demo.images.map((image) => image.publicId),
            status: "active",
          },
          $setOnInsert: {
            productId: product._id,
            sku: `${demo.skuStem}-${size}`,
            size,
            taxRateBps: null,
            hsn: null,
            stockOnHand: 12 + index,
            stockReserved: 0,
            reorderLevel: 3,
            weightGrams: 250,
          },
        },
        { runValidators: true, session, upsert: true },
      );
    }
  }

  await ShippingMethodModel.updateOne(
    { name: "[DEMO] Standard delivery" },
    {
      $setOnInsert: {
        name: "[DEMO] Standard delivery",
        description: "Demonstration rate for local acceptance testing only.",
        ratePaise: 7_900,
        freeShippingThresholdPaise: 149_900,
        estimatedBusinessDaysMin: 3,
        estimatedBusinessDaysMax: 7,
        countries: ["India"],
        postalPrefixes: [],
        codEligible: true,
        active: true,
        sortOrder: 10,
      },
    },
    { session, upsert: true },
  );
  await CouponModel.updateOne(
    { code: "DEMO10" },
    {
      $setOnInsert: {
        code: "DEMO10",
        description: "Demonstration 10% discount for local acceptance tests.",
        discountType: "percentage",
        valuePaise: null,
        valueBps: 1_000,
        minimumSubtotalPaise: 50_000,
        maximumDiscountPaise: 20_000,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2099-01-01T00:00:00.000Z"),
        usageLimit: 1_000,
        redeemedCount: 0,
        perUserLimit: 5,
        categoryIds: [],
        productIds: [],
        active: true,
      },
    },
    { session, upsert: true },
  );
  await SiteSettingsModel.updateOne(
    { key: "default" },
    {
      $set: {
        checkout: {
          reservationMinutes: 12,
          guestCheckoutEnabled: false,
          codEnabled: true,
          codMinimumOrderPaise: 0,
          codMaximumOrderPaise: null,
          codPostalPrefixes: [],
          codConfirmationRequired: true,
        },
        payments: { onlineEnabled: true },
        maintenanceMode: false,
      },
    },
    { runValidators: true, session },
  );
}

export async function runDemoSeed(): Promise<"applied" | "already-applied"> {
  if (await SeedMigrationModel.exists({ version: DEMO_VERSION })) return "already-applied";
  const session = await mongoose.startSession();
  try {
    let applied = false;
    await session.withTransaction(async () => {
      if (await SeedMigrationModel.exists({ version: DEMO_VERSION }).session(session)) return;
      await applyDemoSeed(session);
      await SeedMigrationModel.create(
        [
          {
            version: DEMO_VERSION,
            description:
              "Seed approved THREAD client photography as clearly labelled local demo catalogue data",
            appliedAt: new Date(),
          },
        ],
        { session },
      );
      applied = true;
    });
    return applied ? "applied" : "already-applied";
  } finally {
    await session.endSession();
  }
}

export function isValidDemoSeedConfirmation(value: string | undefined): boolean {
  return value === "SEED_THREAD_DEMO";
}

export const demoSeedProductSlugs = demoProducts.map((product) => product.slug);
export const demoSeedProductImageCount = selectedAssets.reduce(
  (count, product) => count + product.images.length,
  0,
);
export const demoSeedVersion = DEMO_VERSION;
