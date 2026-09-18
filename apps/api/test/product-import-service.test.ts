import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  ProductImportService,
  ProductImportError,
} from "../src/catalogue/product-import.service.js";
import { HttpError } from "../src/middleware/error-handler.js";

describe("ProductImportService Performance & Resilience", () => {
  it("ProductImportError inherits from HttpError and retains statusCode", () => {
    const error = new ProductImportError("INVALID_ZIP", "Zip file corrupt", 400);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("INVALID_ZIP");
    expect(error.message).toBe("Zip file corrupt");
  });

  it("handles preview of ZIP containing inferred product images", async () => {
    const zip = new JSZip();
    // Simulate image entries
    zip.file("WA-001.jpg", Buffer.from("fake-jpg-content-1"));
    zip.file("WA-002.jpg", Buffer.from("fake-jpg-content-2"));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const service = new ProductImportService();
    const preview = await service.previewImport(buffer, "products.zip");

    expect(preview.totalProducts).toBe(2);
    expect(preview.sampleProducts).toHaveLength(2);
    expect(preview.sampleProducts[0]?.title).toContain("WA001");
  });

  it("executes concurrent worker pool in parallel", async () => {
    const service = new ProductImportService();
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let maxConcurrent = 0;
    let currentRunning = 0;

    // Call private runWithWorkerPool via bracket access
    const results = await (service as any).runWithWorkerPool(
      items,
      4,
      async (item: number) => {
        currentRunning++;
        maxConcurrent = Math.max(maxConcurrent, currentRunning);
        await new Promise((resolve) => setTimeout(resolve, 20));
        currentRunning--;
        return item * 2;
      },
    );

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(maxConcurrent).toBeLessThanOrEqual(4);
    expect(maxConcurrent).toBeGreaterThanOrEqual(2);
  });
});
