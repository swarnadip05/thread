import type { Metadata } from "next";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

export const metadata: Metadata = {
  title: "Accessories",
  description: "Explore THREAD accessories.",
  alternates: { canonical: "/accessories" },
};

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DiscoveryPage
      config={{
        eyebrow: "THREAD / Accessories",
        fixed: { audience: "accessories" },
        pathname: "/accessories",
        title: "Accessories",
      }}
      rawSearchParams={await searchParams}
    />
  );
}
