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
    description: `Shop ${title} from THREAD.`,
    alternates: { canonical: `/category/${encodeURIComponent(slug)}` },
  };
}

export default async function CategoryPage({
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
        eyebrow: "THREAD / Category",
        fixed: { category: slug },
        hideCategory: true,
        pathname: `/category/${encodeURIComponent(slug)}`,
        title: titleFromSlug(slug),
      }}
      rawSearchParams={await searchParams}
    />
  );
}
