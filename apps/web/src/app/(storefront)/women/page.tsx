import type { Metadata } from "next";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

export const metadata: Metadata = {
  title: "Women's fashion",
  description: "Explore THREAD women's styles.",
  alternates: { canonical: "/women" },
};

export default async function WomenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DiscoveryPage
      config={{
        eyebrow: "THREAD / Women",
        fixed: { audience: "women" },
        pathname: "/women",
        title: "Women",
      }}
      rawSearchParams={await searchParams}
    />
  );
}
