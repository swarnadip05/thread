export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://threadfashion.shop").replace(
  /\/$/,
  "",
);

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${siteUrl}/`).toString();
}

export function jsonLd(value: object): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
