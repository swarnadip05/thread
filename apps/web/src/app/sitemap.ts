import type { MetadataRoute } from "next";
import { loadDiscoveryData } from "@/services/catalogue";
import { siteUrl } from "@/seo/site";

const staticRoutes = [
  "",
  "/men",
  "/women",
  "/accessories",
  "/search",
  "/about",
  "/contact",
  "/faq",
  "/shipping-delivery",
  "/returns-exchanges",
  "/size-guide",
  "/privacy-policy",
  "/terms-conditions",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const initial = await loadDiscoveryData(new URLSearchParams({ limit: "100", page: "1" }));
  const pages = initial?.page.pages ?? 0;
  const remaining = await Promise.all(
    Array.from({ length: Math.min(Math.max(0, pages - 1), 99) }, (_, index) =>
      loadDiscoveryData(new URLSearchParams({ limit: "100", page: String(index + 2) })),
    ),
  );
  const products = [initial, ...remaining].flatMap((result) => result?.page.items ?? []);
  return [
    ...staticRoutes.map((path) => ({
      url: `${siteUrl}${path}`,
      changeFrequency: "weekly" as const,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/shop/${encodeURIComponent(product.slug)}`,
      lastModified: new Date(product.publishedAt),
      changeFrequency: "weekly" as const,
    })),
  ];
}
