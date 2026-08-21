import type { MetadataRoute } from "next";
import { siteUrl } from "@/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/men",
          "/women",
          "/accessories",
          "/category/",
          "/collection/",
          "/shop/",
          "/search",
        ],
        disallow: ["/admin", "/account", "/auth", "/checkout", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
