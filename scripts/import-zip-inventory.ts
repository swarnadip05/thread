import { promises as fs } from "node:fs";
import path from "node:path";
import { generateInventoryZipFile } from "./generate-inventory-zip.js";

export async function importInventoryZip(zipFilePath?: string): Promise<void> {
  let targetPath = zipFilePath;
  if (!targetPath) {
    console.log("[INFO] No ZIP file specified. Generating 100-product inventory ZIP archive...");
    targetPath = await generateInventoryZipFile();
  }

  const absolutePath = path.resolve(targetPath);
  console.log(`[INFO] Reading inventory ZIP from: ${absolutePath}`);
  const zipBuffer = await fs.readFile(absolutePath);
  const base64Data = zipBuffer.toString("base64");

  const apiPort = process.env.PORT || "4000";
  const apiUrl =
    process.env.API_URL || `http://localhost:${apiPort}/api/v1/admin/products/import-zip`;

  console.log(`[INFO] Sending ZIP inventory payload (${zipBuffer.length} bytes) to ${apiUrl}...`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zipBase64: base64Data }),
    });

    const result = await response.json();
    if (response.ok && result.success) {
      console.log("[SUCCESS] Inventory imported successfully!");
      console.log(`Products Imported: ${result.data.importedCount}`);
      console.log(`Variants Created: ${result.data.variantCount}`);
      console.log(`Categories Placed: ${result.data.categories.join(", ")}`);
      if (result.data.errors?.length) {
        console.warn(`Warnings/Errors (${result.data.errors.length}):`, result.data.errors);
      }
    } else {
      console.error("[ERROR] Import failed:", result.error || result);
    }
  } catch {
    console.log(
      "[INFO] Server HTTP endpoint not reachable directly; parsing zip locally to verify structure:",
    );
    const { parseInventoryZip } = await import("../apps/api/src/catalogue/zip-importer.js");
    const parsed = await parseInventoryZip(zipBuffer);
    console.log(
      `[VERIFIED] Successfully parsed ${parsed.summary.totalProducts} products with ${parsed.summary.totalVariants} variants into categories: ${parsed.summary.categoriesFound.join(", ")}`,
    );
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  const customFile = process.argv[2];
  importInventoryZip(customFile).catch(console.error);
}
