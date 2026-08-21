import type { Metadata } from "next";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DiscoveryPage
      config={{
        eyebrow: "THREAD / Search",
        pathname: "/search",
        title: "Search THREAD",
      }}
      rawSearchParams={await searchParams}
    />
  );
}
