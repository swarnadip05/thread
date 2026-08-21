import type {
  ApiResponse,
  ProductDetailDto,
  ProductFacetsDto,
  ProductPageDto,
  ProductPurchaseConfigDto,
  ProductReviewPageDto,
  ProductSummaryDto,
} from "@thread/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

export async function loadProductSlugRedirect(slug: string): Promise<string | null> {
  const safeSlug = encodeURIComponent(slug);
  const response = await catalogueGet<{ slug: string | null }>(
    `/catalog/products/${safeSlug}/redirect`,
  );
  return response?.slug ?? null;
}

async function catalogueGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}/api/v1${path}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ApiResponse<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

export async function loadProductDetail(slug: string): Promise<ProductDetailData | null> {
  const safeSlug = encodeURIComponent(slug);
  const [product, related, reviews, purchaseConfig] = await Promise.all([
    catalogueGet<ProductDetailDto>(`/catalog/products/${safeSlug}`),
    catalogueGet<readonly ProductSummaryDto[]>(`/catalog/products/${safeSlug}/related?limit=8`),
    catalogueGet<ProductReviewPageDto>(`/catalog/products/${safeSlug}/reviews?limit=10`),
    catalogueGet<ProductPurchaseConfigDto>("/catalog/config"),
  ]);
  if (!product) return null;
  return {
    product,
    related: related ?? [],
    reviews: reviews ?? {
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
      ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    purchaseConfig: purchaseConfig ?? { maxQuantity: 10 },
  };
}

export async function loadDiscoveryData(
  parameters: URLSearchParams,
): Promise<DiscoveryData | null> {
  const query = parameters.toString();
  try {
    const [productsResponse, facetsResponse] = await Promise.all([
      fetch(`${apiUrl}/api/v1/catalog/products?${query}`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(4_000),
      }),
      fetch(`${apiUrl}/api/v1/catalog/products/facets?${query}`, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(4_000),
      }),
    ]);
    if (!productsResponse.ok || !facetsResponse.ok) return null;
    const [products, facets] = (await Promise.all([
      productsResponse.json(),
      facetsResponse.json(),
    ])) as [ApiResponse<ProductPageDto>, ApiResponse<ProductFacetsDto>];
    return products.success && facets.success ? { page: products.data, facets: facets.data } : null;
  } catch {
    return null;
  }
}
