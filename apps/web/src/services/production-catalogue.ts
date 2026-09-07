import type {
  ProductFacetsDto,
  ProductPageDto,
  ProductReviewPageDto,
  ProductSummaryDto,
} from "@thread/types";

import { productionCatalogue, type ProductionCatalogueProduct } from "@/data/production-catalogue";
import type { DiscoveryData, ProductDetailData } from "./catalogue";

const split = (value: string | null) => (value ?? "").split(",").filter(Boolean);
const label = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const discount = (product: ProductionCatalogueProduct) =>
  product.minMrpPaise > 0
    ? Math.round(((product.minMrpPaise - product.minSalePricePaise) / product.minMrpPaise) * 100)
    : 0;

function matches(product: ProductionCatalogueProduct, parameters: URLSearchParams): boolean {
  if (!product.active) return false;
  const audience = parameters.get("audience");
  if (audience && product.audience !== audience && product.audience !== "unisex") return false;
  const categories = split(parameters.get("category"));
  if (categories.length && !categories.some((category) => product.categories.includes(category)))
    return false;
  if (parameters.has("collection")) return false;
  const sizes = split(parameters.get("size"));
  if (sizes.length && !product.variants.some((variant) => sizes.includes(variant.size)))
    return false;
  const colours = split(parameters.get("colour"));
  if (colours.length && !product.variants.some((variant) => colours.includes(variant.colour)))
    return false;
  const fits = split(parameters.get("fit"));
  if (fits.length && (!product.fit || !fits.includes(product.fit))) return false;
  const materials = split(parameters.get("material"));
  if (materials.length && (!product.material || !materials.includes(product.material)))
    return false;
  if (parameters.get("availability") === "in_stock" && !product.available) return false;
  const minimumRating = Number(parameters.get("rating") || 0);
  if (minimumRating && product.ratingAverage < minimumRating) return false;
  const minimumDiscount = Number(parameters.get("discount") || 0);
  if (minimumDiscount && discount(product) < minimumDiscount) return false;
  const minimumPrice = Number(parameters.get("minPrice") || 0);
  const maximumPrice = Number(parameters.get("maxPrice") || Number.MAX_SAFE_INTEGER);
  if (product.minSalePricePaise < minimumPrice || product.minSalePricePaise > maximumPrice)
    return false;
  const search = (parameters.get("search") ?? "").trim().toLocaleLowerCase();
  return (
    !search ||
    `${product.title} ${product.shortDescription} ${product.tags.join(" ")}`
      .toLocaleLowerCase()
      .includes(search)
  );
}

function facet(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ value, label: label(value), count }));
}

function facets(products: readonly ProductionCatalogueProduct[]): ProductFacetsDto {
  const prices = products.map((product) => product.minSalePricePaise);
  return {
    audiences: facet(products.map((product) => product.audience)),
    categories: facet(products.flatMap((product) => product.categories)),
    collections: [],
    sizes: facet(products.flatMap((product) => product.variants.map((variant) => variant.size))),
    colours: facet(
      products.flatMap((product) => product.variants.map((variant) => variant.colour)),
    ),
    fits: facet(products.flatMap((product) => (product.fit ? [product.fit] : []))),
    materials: facet(products.flatMap((product) => (product.material ? [product.material] : []))),
    ratings: [],
    availability: [
      {
        value: "in_stock",
        label: "In stock",
        count: products.filter((product) => product.available).length,
      },
    ],
    discounts: facet(
      products.map((product) => String(discount(product))).filter((value) => value !== "0"),
    ),
    price: {
      minPaise: prices.length ? Math.min(...prices) : 0,
      maxPaise: prices.length ? Math.max(...prices) : 0,
    },
  };
}

export function loadProductionDiscovery(parameters: URLSearchParams): DiscoveryData {
  let products = productionCatalogue.filter((product) => matches(product, parameters));
  const sort = parameters.get("sort");
  products = [...products].sort((left, right) => {
    if (sort === "price_low_high") return left.minSalePricePaise - right.minSalePricePaise;
    if (sort === "price_high_low") return right.minSalePricePaise - left.minSalePricePaise;
    if (sort === "discount") return discount(right) - discount(left);
    if (sort === "rating") return right.ratingAverage - left.ratingAverage;
    return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  });
  const page = Math.max(1, Number(parameters.get("page") || 1));
  const limit = Math.max(1, Number(parameters.get("limit") || 24));
  const start = (page - 1) * limit;
  const items: readonly ProductSummaryDto[] = products.slice(start, start + limit);
  const result: ProductPageDto = {
    items,
    page,
    limit,
    total: products.length,
    pages: Math.max(1, Math.ceil(products.length / limit)),
  };
  return { page: result, facets: facets(products) };
}

const emptyReviews: ProductReviewPageDto = {
  items: [],
  page: 1,
  limit: 10,
  total: 0,
  pages: 1,
  ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export function loadProductionProduct(slug: string): ProductDetailData | null {
  const product = productionCatalogue.find(
    (candidate) => candidate.active && candidate.slug === slug,
  );
  if (!product) return null;
  return {
    product,
    related: productionCatalogue
      .filter(
        (candidate) =>
          candidate.active && candidate.slug !== slug && candidate.audience === product.audience,
      )
      .slice(0, 8),
    reviews: emptyReviews,
    purchaseConfig: { maxQuantity: 10 },
  };
}

export function productionProductSummaries(limit = 4): readonly ProductSummaryDto[] {
  return productionCatalogue.filter((product) => product.active).slice(0, limit);
}
