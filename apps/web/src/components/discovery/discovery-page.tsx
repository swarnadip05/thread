import Link from "next/link";
import type { ProductFacetsDto } from "@thread/types";
import { EmptyState, ErrorState } from "@thread/ui";

import {
  catalogueApiParams,
  normalizeDiscoveryParams,
  type RawSearchParams,
} from "@/discovery/url-state";
import { loadDiscoveryData } from "@/services/catalogue";
import { DiscoveryToolbar } from "./discovery-toolbar";
import { FilterPanel } from "./filter-panel";
import { PaginationLinks } from "./pagination-links";
import { ProductCard } from "./product-card";
import { SearchAnalytics } from "./search-analytics";
import { ItemListAnalytics } from "@/analytics/item-list-analytics";

const emptyFacets: ProductFacetsDto = {
  audiences: [],
  categories: [],
  collections: [],
  sizes: [],
  colours: [],
  fits: [],
  materials: [],
  ratings: [],
  availability: [],
  discounts: [],
  price: { minPaise: 0, maxPaise: 0 },
};

export interface DiscoveryRouteConfig {
  readonly eyebrow: string;
  readonly fixed?: { audience?: string; category?: string; collection?: string };
  readonly hideCategory?: boolean;
  readonly pathname: string;
  readonly title: string;
}

export async function DiscoveryPage({
  config,
  rawSearchParams,
}: {
  config: DiscoveryRouteConfig;
  rawSearchParams: RawSearchParams;
}) {
  const parameters = normalizeDiscoveryParams(rawSearchParams);
  const data = await loadDiscoveryData(catalogueApiParams(parameters, config.fixed));
  const facets = data?.facets ?? emptyFacets;
  const query = parameters.get("q") ?? "";
  const clearParameters = new URLSearchParams();
  if (query) clearParameters.set("q", query);
  const sort = parameters.get("sort");
  if (sort) clearParameters.set("sort", sort);
  const clearHref = clearParameters.size
    ? `${config.pathname}?${clearParameters.toString()}`
    : config.pathname;

  return (
    <section className="shell-container py-8 sm:py-12" aria-labelledby="discovery-heading">
      {query ? <SearchAnalytics query={query} resultCount={data?.page.total ?? 0} /> : null}
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{config.eyebrow}</p>
      <h1
        className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl"
        id="discovery-heading"
      >
        {config.title}
      </h1>
      {query ? (
        <p className="mt-3 text-sm text-muted">
          Results for <span className="font-semibold text-ink">“{query}”</span>
        </p>
      ) : null}
      <div className="mt-8">
        <DiscoveryToolbar
          facets={facets}
          {...(config.hideCategory !== undefined ? { hideCategory: config.hideCategory } : {})}
          pathname={config.pathname}
          total={data?.page.total ?? 0}
        />
      </div>
      <div className="mt-4 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10">
        <aside
          aria-label="Product filters"
          className="hidden max-h-[calc(100dvh-9rem)] self-start overflow-y-auto pr-2 lg:sticky lg:top-32 lg:block"
        >
          <div className="flex items-center justify-between border-b border-ink/10 pb-2">
            <h2 className="text-lg font-semibold">Filters</h2>
            {parameters.toString() ? (
              <Link
                className="focus-ring rounded-sm text-xs font-semibold underline underline-offset-4"
                href={clearHref}
              >
                Clear all
              </Link>
            ) : null}
          </div>
          <FilterPanel
            facets={facets}
            {...(config.hideCategory !== undefined ? { hideCategory: config.hideCategory } : {})}
            pathname={config.pathname}
          />
        </aside>
        <div>
          {!data ? (
            <ErrorState
              description="The catalogue service could not be reached. Please try again shortly."
              title="Products are temporarily unavailable"
            />
          ) : data.page.items.length ? (
            <>
              <ItemListAnalytics items={data.page.items} listName={config.title} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4">
                {data.page.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <PaginationLinks
                currentPage={data.page.page}
                parameters={parameters}
                pathname={config.pathname}
                totalPages={data.page.pages}
              />
            </>
          ) : (
            <EmptyState
              action={
                <Link
                  className="focus-ring inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-semibold text-paper"
                  href={config.pathname}
                >
                  Clear filters
                </Link>
              }
              description="Try removing a filter or searching for a different style."
              title="No styles match these filters"
            />
          )}
        </div>
      </div>
    </section>
  );
}
