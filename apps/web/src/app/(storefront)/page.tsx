import { HomepageSections } from "@/components/homepage/homepage-sections";
import { loadHomepage, loadHomepageProducts } from "@/services/site-settings";

export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const homepage = await loadHomepage(preview);
  const newArrivalsSection = homepage.sections.find((section) => section.type === "new_arrivals");
  const bestSellersSection = homepage.sections.find((section) => section.type === "best_sellers");
  const [newArrivals, bestSellers] = await Promise.all([
    newArrivalsSection
      ? loadHomepageProducts("newest", newArrivalsSection.collectionSlugs)
      : Promise.resolve([]),
    bestSellersSection
      ? loadHomepageProducts("best_sellers", bestSellersSection.collectionSlugs)
      : Promise.resolve([]),
  ]);

  return (
    <HomepageSections
      bestSellers={bestSellers}
      newArrivals={newArrivals}
      sections={homepage.sections}
    />
  );
}
