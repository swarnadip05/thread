import Link from "next/link";
import type { HomepageSectionDto, ProductSummaryDto } from "@thread/types";

import { ProductCard } from "@/components/discovery/product-card";
import { SectionHeading } from "./section-heading";

export function ProductRail({
  products,
  section,
  tone = "paper",
}: {
  products: readonly ProductSummaryDto[];
  section: HomepageSectionDto;
  tone?: "ivory" | "paper";
}) {
  if (!products.length && process.env.NODE_ENV !== "development") return null;
  return (
    <section
      aria-labelledby={`${section.id}-title`}
      className={`homepage-reveal py-12 sm:py-16 ${tone === "ivory" ? "bg-ivory" : "bg-paper"}`}
    >
      <div className="shell-container">
        <div id={`${section.id}-title`}>
          <SectionHeading section={section} />
        </div>
        {products.length ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
            {products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-lg border border-ink/10 bg-paper px-6 py-10 text-center">
            <p className="font-semibold">No published styles are available yet.</p>
            <Link
              className="focus-ring mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper"
              href="/search"
            >
              Browse the catalogue
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
