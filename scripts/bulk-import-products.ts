import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import AdmZip from "adm-zip";
import pino from "pino";

import { connectDatabase, disconnectDatabase } from "../apps/api/src/database/connection.js";
import { ProductImportService } from "../apps/api/src/catalogue/product-import.service.js";
import { runSeedMigrations } from "../apps/api/src/seeds/migrations.js";

// Load environment variables with fallback paths
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env.example") });

const logger = pino({
  transport: {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
  },
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="));
  const isDryRun = args.includes("--dry-run");

  // Determine file path
  let targetPath = fileArg ? fileArg.split("=")[1] : undefined;

  if (!targetPath) {
    // Look for common candidates
    const candidates = [
      "scripts/test-sample-inventory.xlsx",
      "scripts/products.xlsx",
      "scripts/inventory.xlsx",
      "scripts/products.zip",
      "scripts/products.csv",
      "scripts/products-template.json",
    ];
    for (const cand of candidates) {
      if (fs.existsSync(path.resolve(process.cwd(), cand))) {
        targetPath = cand;
        break;
      }
    }
  }

  if (!targetPath) {
    logger.error(
      "No input file specified. Usage: pnpm import:products --file=<path-to-zip-or-excel> [--dry-run]",
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(resolvedPath)) {
    logger.error(`Specified file not found at: ${resolvedPath}`);
    process.exit(1);
  }

  const isDirectory = fs.statSync(resolvedPath).isDirectory();
  let fileBuffer: Buffer;
  let filename: string;

  if (isDirectory) {
    logger.info(`Detected directory source. Packaging folder into in-memory archive...`);
    const zip = new AdmZip();
    zip.addLocalFolder(resolvedPath, path.basename(resolvedPath));
    fileBuffer = zip.toBuffer();
    filename = `${path.basename(resolvedPath)}.zip`;
  } else {
    fileBuffer = fs.readFileSync(resolvedPath);
    filename = path.basename(resolvedPath);
  }

  logger.info(`==========================================================`);
  logger.info(`📦 THREAD AUTOMATED PRODUCT & INVENTORY IMPORTER`);
  logger.info(`Source: ${resolvedPath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  logger.info(`Mode: ${isDryRun ? "DRY-RUN (Validation & Preview Only)" : "LIVE DATABASE IMPORT"}`);
  logger.info(`==========================================================`);

  const importService = new ProductImportService();

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/thread_commerce?replicaSet=rs0";
  let isDbConnected = false;

  logger.info(`Checking MongoDB connection...`);
  try {
    const isLocalhost = uri.includes("localhost") || uri.includes("127.0.0.1");
    if (isDryRun && isLocalhost) {
      const canConnect = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: 27017 }, () => {
          socket.destroy();
          resolve(true);
        });
        socket.setTimeout(800);
        socket.on("error", () => resolve(false));
        socket.on("timeout", () => {
          socket.destroy();
          resolve(false);
        });
      });
      if (!canConnect) {
        throw new Error("Local MongoDB is not running on 127.0.0.1:27017");
      }
    }
    await connectDatabase(uri, logger);
    isDbConnected = true;
    logger.info("Connected to MongoDB successfully.");
  } catch (dbErr) {
    if (isDryRun) {
      logger.warn(
        `Could not connect to MongoDB (${(dbErr as Error).message}). Continuing in offline preview mode.`,
      );
    } else {
      logger.error(
        { err: dbErr },
        "Failed to connect to MongoDB for live import. Ensure MongoDB is running.",
      );
      process.exit(1);
    }
  }

  try {
    // 1. Ensure migrations are up to date if connected
    if (isDbConnected) {
      logger.info("Ensuring database migrations are up to date...");
      await runSeedMigrations();
    }

    // 2. Perform intelligent preview & analysis
    logger.info("Analyzing product descriptions, matching columns, and classifying categories...");
    const preview = await importService.previewImport(fileBuffer, filename);

    logger.info(
      `✓ Found ${preview.totalProducts} products across ${preview.detectedColumns.length} columns.`,
    );
    logger.info(`  • Standard columns mapped: ${preview.standardColumns.join(", ") || "None"}`);
    if (preview.dynamicColumns.length > 0) {
      logger.info(`  • Dynamic custom columns captured: ${preview.dynamicColumns.join(", ")}`);
    } else {
      logger.info(`  • Dynamic custom columns: None (all matched standard catalogue fields)`);
    }

    logger.info(
      `  • Existing categories matched: ${preview.existingCategoriesMatched.map((c) => `${c.name} (${c.count})`).join(", ") || "None"}`,
    );
    if (preview.categoriesToCreate.length > 0) {
      logger.info(`  • NEW categories to auto-create from descriptions:`);
      for (const cat of preview.categoriesToCreate) {
        logger.info(
          `    + [NEW CATEGORY] "${cat.name}" (slug: ${cat.slug}, audience: ${cat.audience}) -> ${cat.count} products`,
        );
      }
    }

    if (isDryRun) {
      logger.info("\n[DRY RUN] Preview of first 5 products to be placed:");
      for (let i = 0; i < Math.min(5, preview.sampleProducts.length); i++) {
        const p = preview.sampleProducts[i]!;
        logger.info(
          `  ${i + 1}. ${p.title} | Category: ${p.categoryName} (${p.audience}) | MRP: ₹${p.mrp} | Sale: ₹${p.salePrice} | Sizes: ${p.sizes.join(",")}`,
        );
      }
      logger.info("\n✅ Dry run completed successfully. To commit changes, run without --dry-run.");
      return;
    }

    // 3. Execute live import
    logger.info("\nExecuting automated database import...");
    const result = await importService.executeImport(fileBuffer, filename, "cli-automated-import", {
      ip: "127.0.0.1",
      userAgent: "cli-bulk-importer",
    });

    logger.info(`\n==========================================================`);
    logger.info(`🎉 IMPORT COMPLETED SUCCESSFULLY!`);
    logger.info(`  • Total products processed: ${result.totalProcessed}`);
    logger.info(`  • Products created:        ${result.productsCreated}`);
    logger.info(`  • Products updated:        ${result.productsUpdated}`);
    logger.info(`  • Variants generated:      ${result.variantsCreated}`);
    logger.info(`  • New categories created:  ${result.categoriesCreated.length}`);
    if (result.categoriesCreated.length > 0) {
      for (const c of result.categoriesCreated) {
        logger.info(`      + Created: ${c.name} (${c.slug})`);
      }
    }
    if (result.dynamicColumnsCatalogued.length > 0) {
      logger.info(`  • Dynamic columns indexed: ${result.dynamicColumnsCatalogued.join(", ")}`);
    }
    if (result.errors.length > 0) {
      logger.warn(`  • Warnings/Errors (${result.errors.length}):`);
      for (const e of result.errors) {
        logger.warn(`      ! ${e.item}: ${e.error}`);
      }
    }
    logger.info(`==========================================================`);
  } finally {
    if (isDbConnected) {
      await disconnectDatabase(logger);
    }
  }
}

main().catch((err) => {
  logger.error({ err }, "Import script encountered a fatal error.");
  process.exit(1);
});
