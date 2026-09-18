import type {
  ApiResponse,
  ProductDetailDto,
  ProductFacetsDto,
  ProductPageDto,
  ProductPurchaseConfigDto,
  ProductReviewPageDto,
  ProductSummaryDto,
} from "@thread/types";
import { API_URL, USE_STATIC_CATALOGUE } from "@/config/api-url";
import { loadProductionDiscovery, loadProductionProduct } from "./production-catalogue";

export interface DiscoveryData {
  readonly page: ProductPageDto;
  readonly facets: ProductFacetsDto;
}

export interface ProductDetailData {
  readonly product: ProductDetailDto;
  readonly related: readonly ProductSummaryDto[];
  readonly reviews: ProductReviewPageDto;
  readonly purchaseConfig: ProductPurchaseConfigDto;
}

export interface CatalogueUnavailable {
  readonly unavailable: true;
}

export type ProductDetailResult = ProductDetailData | CatalogueUnavailable | null;

export function isCatalogueUnavailable(value: ProductDetailResult): value is CatalogueUnavailable {
  return value !== null && "unavailable" in value;
}

interface CatalogueResponse<T> {
  readonly data: T | null;
  readonly unavailable: boolean;
}

export async function loadProductSlugRedirect(slug: string): Promise<string | null> {
  const safeSlug = encodeURIComponent(slug);
  const response = await catalogueGet<{ slug: string | null }>(
    `/catalog/products/${safeSlug}/redirect`,
  );
  return response.data?.slug ?? null;
}

async function catalogueGet<T>(path: string): Promise<CatalogueResponse<T>> {
  if (!API_URL) return { data: null, unavailable: true };
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000), // 10 s — handles Render cold-start
    });
    if (response.status === 404) return { data: null, unavailable: false };
    if (!response.ok) return { data: null, unavailable: true };
    const body = (await response.json()) as ApiResponse<T>;
    return body.success
      ? { data: body.data, unavailable: false }
      : { data: null, unavailable: true };
  } catch {
    return { data: null, unavailable: true };
  }
}

export async function loadProductDetail(slug: string): Promise<ProductDetailResult> {
  const safeSlug = encodeURIComponent(slug);
  const [product, related, reviews, purchaseConfig] = await Promise.all([
    catalogueGet<ProductDetailDto>(`/catalog/products/${safeSlug}`),
    catalogueGet<readonly ProductSummaryDto[]>(`/catalog/products/${safeSlug}/related?limit=8`),
    catalogueGet<ProductReviewPageDto>(`/catalog/products/${safeSlug}/reviews?limit=10`),
    catalogueGet<ProductPurchaseConfigDto>("/catalog/config"),
  ]);
  if (!product.data) {
    if (USE_STATIC_CATALOGUE) return loadProductionProduct(slug);
    return product.unavailable ? { unavailable: true } : null;
  }
  return {
    product: product.data,
    related: related.data ?? [],
    reviews: reviews.data ?? {
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    purchaseConfig: purchaseConfig.data ?? { maxQuantity: 10 },
  };
}

export async function loadDiscoveryData(
  parameters: URLSearchParams,
): Promise<DiscoveryData | null> {
  if (!API_URL) return USE_STATIC_CATALOGUE ? loadProductionDiscovery(parameters) : null;
  const query = parameters.toString();
  try {
    const [productsResponse, facetsResponse] = await Promise.all([
      fetch(`${API_URL}/api/v1/catalog/products?${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${API_URL}/api/v1/catalog/products/facets?${query}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }),
    ]);
    if (!productsResponse.ok || !facetsResponse.ok)
      return USE_STATIC_CATALOGUE ? loadProductionDiscovery(parameters) : null;
    const [products, facets] = (await Promise.all([
      productsResponse.json(),
      facetsResponse.json(),
    ])) as [ApiResponse<ProductPageDto>, ApiResponse<ProductFacetsDto>];
    return products.success && facets.success
      ? { page: products.data, facets: facets.data }
      : USE_STATIC_CATALOGUE
        ? loadProductionDiscovery(parameters)
        : null;
  } catch {
    return USE_STATIC_CATALOGUE ? loadProductionDiscovery(parameters) : null;
  }
}
