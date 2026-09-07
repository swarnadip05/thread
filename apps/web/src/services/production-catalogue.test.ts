import { describe, expect, it } from "vitest";

import { loadProductionDiscovery, loadProductionProduct } from "./production-catalogue";

describe("production catalogue fallback", () => {
  it("filters departments and category slugs", () => {
    const men = loadProductionDiscovery(new URLSearchParams({ audience: "men" }));
    const women = loadProductionDiscovery(new URLSearchParams({ audience: "women" }));
    const oversized = loadProductionDiscovery(
      new URLSearchParams({ audience: "men", category: "oversized-t-shirts" }),
    );
    expect(men.page.total).toBe(4);
    expect(women.page.total).toBe(3);
    expect(oversized.page.items.length).toBeGreaterThan(0);
    expect(oversized.page.items.every((product) => product.audience === "men")).toBe(true);
  });

  it("provides real product details without fabricated reviews", () => {
    const detail = loadProductionProduct("mens-oversized-graphic-tshirt-olive-green");
    expect(detail?.product.primaryImage?.secureUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(detail?.product.variants.length).toBeGreaterThan(0);
    expect(detail?.reviews.total).toBe(0);
  });
});
