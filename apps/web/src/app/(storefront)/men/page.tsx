import type { Metadata } from "next";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

export const metadata: Metadata = {
  title: "Men's fashion",
  description: "Explore THREAD men's styles.",
  alternates: { canonical: "/men" },
};

export default async function MenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DiscoveryPage
      config={{
        eyebrow: "THREAD / Men",
        fixed: { audience: "men" },
        pathname: "/men",
        title: "Men",
      }}
      rawSearchParams={await searchParams}
    />
  );
}
