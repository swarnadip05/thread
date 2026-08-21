import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ProductFacetsDto, ProductSummaryDto } from "@thread/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("size=M&sort=newest"),
}));

import { DiscoveryToolbar } from "@/components/discovery/discovery-toolbar";
import { ProductCard, productHref } from "@/components/discovery/product-card";
import {
  catalogueApiParams,
  discoveryHref,
  normalizeDiscoveryParams,
  toggleFilterValue,
} from "./url-state";

const facets: ProductFacetsDto = {
  audiences: [],
  categories: [],
  collections: [],
  sizes: [{ value: "M", label: "M", count: 4 }],
  colours: [],
  fits: [],
  materials: [],
  ratings: [],
  availability: [],
  discounts: [],
  price: { minPaise: 50_000, maxPaise: 200_000 },
};

describe("discovery URL state", () => {
  it("normalizes shareable filters and maps the public q parameter to API search", () => {
    const normalized = normalizeDiscoveryParams({
      q: "  black tee ",
      page: "2",
      size: ["L,M", "M"],
      discount: "20",
      sort: "price_low_high",
      ignored: "unsafe",
    });
    expect(normalized.toString()).toBe(
      "size=L%2CM&page=2&sort=price_low_high&q=black+tee&discount=20",
    );
    expect(catalogueApiParams(normalized, { audience: "men" }).toString()).toContain(
      "search=black+tee",
    );
    expect(catalogueApiParams(normalized, { audience: "men" }).get("audience")).toBe("men");
  });

  it("toggles filters without losing unrelated URL state and resets pagination", () => {
    const current = new URLSearchParams("q=tee&size=M&page=4");
    const next = toggleFilterValue(current, "size", "L");
    expect(discoveryHref("/men", next)).toBe("/men?q=tee&size=L%2CM");
    expect(toggleFilterValue(next, "size", "M").get("size")).toBe("L");
  });
});

describe("product discovery UI contracts", () => {
  it("renders accessible mobile filter and sort sheet triggers", () => {
    const html = renderToStaticMarkup(
      createElement(DiscoveryToolbar, { facets, pathname: "/men", total: 4 }),
    );
    expect(html).toContain("Filter products");
    expect(html).toContain(">Filters<");
    expect(html).toContain("Sort products");
    expect(html).toContain(">Sort<");
  });

  it("uses a keyboard-focusable canonical product-card link", () => {
    const product: ProductSummaryDto = {
      id: "product-1",
      title: "THREAD Essential Tee",
      slug: "thread-essential-tee",
      shortDescription: "A core THREAD tee.",
      audience: "men",
      brand: "THREAD",
      colours: [{ name: "Black", hex: "#111111" }],
      minMrpPaise: 129_900,
      minSalePricePaise: 99_900,
      ratingAverage: 4.5,
      ratingCount: 12,
      available: true,
      publishedAt: "2026-07-26T00:00:00.000Z",
    };
    expect(productHref(product.slug)).toBe("/shop/thread-essential-tee");
    const html = renderToStaticMarkup(createElement(ProductCard, { product }));
    expect(html).toContain('href="/shop/thread-essential-tee"');
    expect(html).toContain("focus-ring");
    expect(html).toContain("Add THREAD Essential Tee to wishlist");
  });
});
