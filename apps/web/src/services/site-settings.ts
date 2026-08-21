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

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const publicFallbackHomepage: PublicHomepageDto = {
  ...fallbackHomepage,
  sections: fallbackHomepage.sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder),
};

async function publicApi<T>(path: string): Promise<T | null> {
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
  sort: "newest" | "rating",
  collectionSlugs: readonly string[],
): Promise<readonly ProductSummaryDto[]> {
  const parameters = new URLSearchParams({ limit: "4", page: "1", sort });
  if (collectionSlugs.length) parameters.set("collection", collectionSlugs.join(","));
  try {
    const response = await fetch(`${apiUrl}/api/v1/catalog/products?${parameters}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return [];
    const body = (await response.json()) as ApiResponse<ProductPage>;
    return body.success ? body.data.items : [];
  } catch {
    return [];
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
