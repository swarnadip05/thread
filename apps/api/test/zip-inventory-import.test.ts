import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseInventoryZip } from "../src/catalogue/zip-importer.js";

describe("Zip Inventory Importer", () => {
  it("parses valid ZIP archive containing 100 products manifest and images", async () => {
    const zip = new JSZip();
    const manifest = Array.from({ length: 100 }, (_, i) => ({
      title: `Test Product ${i + 1}`,
      slug: `test-product-${i + 1}`,
      audience: i % 2 === 0 ? "men" : "women",
      categorySlug: i < 40 ? "t-shirts" : i < 80 ? "oversized-t-shirts" : "caps",
      brand: "THREAD",
      fit: "Oversized",
      variants: [
        { sku: `TEST-${i + 1}-S`, colour: "Black", size: "S", mrpPaise: 79900, salePricePaise: 59900, availableStock: 10 },
        { sku: `TEST-${i + 1}-M`, colour: "Black", size: "M", mrpPaise: 79900, salePricePaise: 59900, availableStock: 15 },
      ],
    }));

    zip.file("manifest.json", JSON.stringify(manifest));
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    const result = await parseInventoryZip(zipBuffer);

    expect(result.summary.totalProducts).toBe(100);
    expect(result.summary.totalVariants).toBe(200);
    expect(result.summary.categoriesFound).toContain("t-shirts");
    expect(result.summary.categoriesFound).toContain("oversized-t-shirts");
    expect(result.summary.categoriesFound).toContain("caps");
    expect(result.products[0]?.title).toBe("Test Product 1");
    expect(result.products[0]?.variants).toHaveLength(2);
  });

  it("throws HttpError if manifest is missing from ZIP", async () => {
    const zip = new JSZip();
    zip.file("readme.txt", "Hello World");
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    await expect(parseInventoryZip(zipBuffer)).rejects.toThrow("ZIP archive must contain a manifest.json or products.json file.");
  });
});
