import type {
  ApiResponse,
  ContentPageDto,
  ProductSummaryDto,
  PublicHomepageDto,
  PublicNavigationDto,
  PublicSiteSettingsDto,
} from "@thread/types";
import {
  initialBusinessSettings,
  initialNavigation,
  type SiteSettings,
} from "@/config/site-settings";
import { fallbackContentPages } from "@/content/business-pages";
import { fallbackHomepage } from "@/content/homepage-fallback";
import { productionProductSummaries } from "./production-catalogue";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const apiUrl =
  process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(configuredApiUrl ?? "")
    ? null
    : configuredApiUrl || (process.env.NODE_ENV === "production" ? null : "http://localhost:4000");
const publicFallbackHomepage: PublicHomepageDto = {
  ...fallbackHomepage,
  sections: fallbackHomepage.sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder),
};

async function publicApi<T>(path: string): Promise<T | null> {
  if (!apiUrl) return null;
  try {
    const response = await fetch(`${apiUrl}/api/v1/public${path}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as ApiResponse<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

export async function loadHomepage(previewToken?: string): Promise<PublicHomepageDto> {
  if (previewToken) {
    try {
      const response = await fetch(
        `${apiUrl}/api/v1/public/homepage/preview/${encodeURIComponent(previewToken)}`,
        { cache: "no-store", signal: AbortSignal.timeout(2_000) },
      );
      if (!response.ok) return publicFallbackHomepage;
      const body = (await response.json()) as ApiResponse<PublicHomepageDto>;
      return body.success ? body.data : publicFallbackHomepage;
    } catch {
      return publicFallbackHomepage;
    }
  }
  return (await publicApi<PublicHomepageDto>("/homepage")) ?? publicFallbackHomepage;
}

interface ProductPage {
  readonly items: readonly ProductSummaryDto[];
}

export async function loadHomepageProducts(
  sort: "newest" | "best_sellers",
  collectionSlugs: readonly string[],
): Promise<readonly ProductSummaryDto[]> {
  const parameters = new URLSearchParams({ limit: "4", page: "1", sort: "newest" });
  if (sort === "best_sellers") parameters.set("bestSellers", "true");
  if (sort === "newest") parameters.set("newArrival", "true");
  if (collectionSlugs.length) parameters.set("collection", collectionSlugs.join(","));
  try {
    if (!apiUrl) return productionProductSummaries(4);
    const response = await fetch(`${apiUrl}/api/v1/catalog/products?${parameters}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return productionProductSummaries(4);
    const body = (await response.json()) as ApiResponse<ProductPage>;
    if (body.success && !body.data.items.length && sort === "newest") {
      parameters.delete("newArrival");
      const fallback = await fetch(`${apiUrl}/api/v1/catalog/products?${parameters}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      if (!fallback.ok) return [];
      const page = (await fallback.json()) as ApiResponse<ProductPage>;
      return page.success ? page.data.items : [];
    }
    return body.success ? body.data.items : [];
  } catch {
    return productionProductSummaries(4);
  }
}

export function getSiteSettings(): SiteSettings {
  return initialBusinessSettings;
}
export async function loadPublicSettings(): Promise<PublicSiteSettingsDto> {
  return (await publicApi<PublicSiteSettingsDto>("/site-settings")) ?? initialBusinessSettings;
}
export async function loadPublicNavigation(): Promise<PublicNavigationDto> {
  return (await publicApi<PublicNavigationDto>("/navigation")) ?? initialNavigation;
}
export async function loadContentPage(slug: string): Promise<ContentPageDto | null> {
  return (
    (await publicApi<ContentPageDto>(`/content/${encodeURIComponent(slug)}`)) ??
    fallbackContentPages[slug] ??
    null
  );
}
