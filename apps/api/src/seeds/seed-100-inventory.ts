import mongoose from "mongoose";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseInventoryZip } from "../catalogue/zip-importer.js";
import { CategoryModel } from "../models/category.model.js";
import { ProductModel } from "../catalogue/models/product.model.js";
import { ProductVariantModel } from "../catalogue/models/product-variant.model.js";
import { generateInventoryZipFile } from "../../../../scripts/generate-inventory-zip.js";

async function seed100Inventory(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/thread";
  console.log(`[INFO] Connecting to MongoDB at: ${mongoUri}`);

  let connected = false;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    connected = true;
    console.log("[SUCCESS] Connected to MongoDB database.");
  } catch (err) {
    console.warn("[INFO] Live local MongoDB server not running on port 27017.");
    console.log("[SUCCESS] Generated 100-product inventory ZIP package for Admin UI upload!");
    const zipPath = await generateInventoryZipFile();
    console.log(`[ZIP READY] Package available at ${zipPath}. Admins can upload this via Admin UI (/admin/products -> Import ZIP Inventory).`);
    return;
  }

  if (connected) {
    const zipPath = await generateInventoryZipFile();
    const zipBuffer = await fs.readFile(zipPath);

    const { products, summary } = await parseInventoryZip(zipBuffer);
    console.log(`[INFO] Parsed ${summary.totalProducts} products with ${summary.totalVariants} variants.`);

    const categoryMap = new Map<string, mongoose.Types.ObjectId>();

    const categorySpecs = [
      { name: "Men", slug: "men", audience: "men", active: true, sortOrder: 10 },
      { name: "Women", slug: "women", audience: "women", active: true, sortOrder: 20 },
      { name: "Accessories", slug: "accessories", audience: "accessories", active: true, sortOrder: 30 },
      { name: "T-Shirts", slug: "t-shirts", audience: "unisex", active: true, sortOrder: 40 },
      { name: "Oversized T-Shirts", slug: "oversized-t-shirts", audience: "unisex", active: true, sortOrder: 50 },
      { name: "Classic Fit T-Shirts", slug: "classic-fit-t-shirts", audience: "unisex", active: true, sortOrder: 60 },
      { name: "Caps", slug: "caps", audience: "accessories", active: true, sortOrder: 70 },
    ];

    for (const catSpec of categorySpecs) {
      const doc = await CategoryModel.findOneAndUpdate(
        { slug: catSpec.slug },
        { $setOnInsert: catSpec },
        { upsert: true, new: true },
      );
      categoryMap.set(catSpec.slug, doc._id);
    }

    let createdCount = 0;
    let variantCount = 0;

    for (const item of products) {
      const categoryId = categoryMap.get(item.categorySlug) || categoryMap.get("t-shirts")!;

      const productDoc = await ProductModel.findOneAndUpdate(
        { slug: item.slug },
        {
          $set: {
            title: item.title,
            slug: item.slug,
            shortDescription: item.shortDescription,
            descriptionHtml: item.descriptionHtml,
            categoryIds: [categoryId],
            collectionIds: [],
            audience: item.audience,
            brand: item.brand,
            fit: item.fit,
            material: item.material,
            care: item.care,
            tags: item.tags,
            status: item.status,
            featured: item.featured,
            media: item.images,
            seo: { noIndex: false },
            rating: { average: 4.8, count: 12 },
          },
        },
        { upsert: true, new: true },
      );

      for (const v of item.variants) {
        await ProductVariantModel.findOneAndUpdate(
          { sku: v.sku },
          {
            $set: {
              productId: productDoc._id,
              sku: v.sku,
              colour: v.colour,
              size: v.size,
              attributes: v.attributes,
              mrpPaise: v.mrpPaise,
              salePricePaise: v.salePricePaise,
              stockOnHand: v.initialStock,
              stockReserved: 0,
              status: v.status,
            },
          },
          { upsert: true, new: true },
        );
        variantCount += 1;
      }

      createdCount += 1;
    }

    console.log(`[SUCCESS] Database populated with ${createdCount} products and ${variantCount} inventory variants across designated categories!`);
    await mongoose.disconnect();
  }
}

seed100Inventory().catch(console.error);
