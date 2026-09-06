const productionFallbackUrl = "https://threadfashion.shop";

export function resolveSiteUrl(
  configuredUrl = process.env.NEXT_PUBLIC_SITE_URL,
  environment = process.env.NODE_ENV,
): string {
  const fallback = environment === "production" ? productionFallbackUrl : "http://localhost:3000";
  if (!configuredUrl?.trim()) return fallback;
  try {
    const url = new URL(configuredUrl.trim());
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (environment === "production" && localHost) return productionFallbackUrl;
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export const siteUrl = resolveSiteUrl();

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${siteUrl}/`).toString();
}

export function jsonLd(value: object): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
