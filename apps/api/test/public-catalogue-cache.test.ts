import { describe, expect, it } from "vitest";

import { PublicCatalogueCache } from "../src/catalogue/public-catalogue-cache.js";

describe("PublicCatalogueCache", () => {
  it("bypasses caching by default so live catalogue reads cannot become stale", async () => {
    const cache = new PublicCatalogueCache();
    let calls = 0;

    const read = async () => ++calls;

    await expect(cache.get("products", read)).resolves.toBe(1);
    await expect(cache.get("products", read)).resolves.toBe(2);
  });

  it("preserves opt-in cache and invalidation behaviour", async () => {
    const cache = new PublicCatalogueCache(60_000);
    let calls = 0;

    const read = async () => ++calls;

    await expect(cache.get("products", read)).resolves.toBe(1);
    await expect(cache.get("products", read)).resolves.toBe(1);
    cache.invalidate();
    await expect(cache.get("products", read)).resolves.toBe(2);
  });
});
