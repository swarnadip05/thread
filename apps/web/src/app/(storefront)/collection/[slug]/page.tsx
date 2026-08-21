import type { Metadata } from "next";
import { DiscoveryPage } from "@/components/discovery/discovery-page";

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromSlug(slug);
  return {
    title,
    description: `Explore the ${title} collection from THREAD.`,
    alternates: { canonical: `/collection/${encodeURIComponent(slug)}` },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  return (
    <DiscoveryPage
      config={{
        eyebrow: "THREAD / Collection",
        fixed: { collection: slug },
        pathname: `/collection/${encodeURIComponent(slug)}`,
        title: titleFromSlug(slug),
      }}
      rawSearchParams={await searchParams}
    />
  );
}
