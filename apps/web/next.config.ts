import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 88],
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/shop/men", destination: "/men", permanent: true },
      { source: "/shop/women", destination: "/women", permanent: true },
      { source: "/shop/accessories", destination: "/accessories", permanent: true },
      {
        source: "/shop/t-shirts",
        destination: "/category/t-shirts",
        permanent: true,
      },
      {
        source: "/shop/oversized-t-shirts",
        destination: "/category/oversized-t-shirts",
        permanent: true,
      },
      {
        source: "/shop/classic-fit-t-shirts",
        destination: "/category/classic-fit-t-shirts",
        permanent: true,
      },
      {
        source: "/shop/new-arrivals",
        destination: "/search?sort=newest",
        permanent: true,
      },
      {
        source: "/shop/best-sellers",
        destination: "/search?sort=rating",
        permanent: true,
      },
    ];
  },
  transpilePackages: ["@thread/ui", "@thread/types", "@thread/validation"],
};

export default nextConfig;
