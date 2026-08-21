"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ProductFacetValueDto, ProductFacetsDto } from "@thread/types";
import { Button, Drawer } from "@thread/ui";
import { SlidersHorizontal, SortAsc, X } from "lucide-react";

import {
  discoveryHref,
  multiFilterKeys,
  setFilterValue,
  toggleFilterValue,
  type MultiFilterKey,
  type SingleFilterKey,
} from "@/discovery/url-state";
import { FilterPanel } from "./filter-panel";

const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price_low_high", label: "Price: low to high" },
  { value: "price_high_low", label: "Price: high to low" },
  { value: "discount", label: "Discount" },
  { value: "rating", label: "Rating" },
] as const;

function facetLabel(facets: ProductFacetsDto, key: MultiFilterKey, value: string): string {
  const source: readonly ProductFacetValueDto[] =
    key === "category"
      ? facets.categories
      : key === "size"
        ? facets.sizes
        : key === "colour"
          ? facets.colours
          : key === "fit"
            ? facets.fits
            : facets.materials;
  return source.find((item) => item.value === value)?.label ?? value;
}

export function DiscoveryToolbar({
  facets,
  hideCategory,
  pathname,
  total,
}: {
  facets: ProductFacetsDto;
  hideCategory?: boolean;
  pathname: string;
  total: number;
}) {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const current = new URLSearchParams(searchParameters.toString());
  const chips: Array<{ key: MultiFilterKey | SingleFilterKey; label: string; value: string }> = [];
  for (const key of multiFilterKeys) {
    for (const value of (current.get(key) ?? "").split(",").filter(Boolean))
      chips.push({ key, label: facetLabel(facets, key, value), value });
  }
  const singleLabels: Readonly<Record<SingleFilterKey, (value: string) => string>> = {
    availability: () => "In stock",
    rating: (value) => `${value}+ stars`,
    discount: (value) => `${value}%+ off`,
    minPrice: (value) => `From ₹${Math.round(Number(value) / 100)}`,
    maxPrice: (value) => `Up to ₹${Math.round(Number(value) / 100)}`,
  };
  for (const key of Object.keys(singleLabels) as SingleFilterKey[]) {
    const value = current.get(key);
    if (value) chips.push({ key, label: singleLabels[key](value), value });
  }

  function navigate(next: URLSearchParams) {
    router.push(discoveryHref(pathname, next), { scroll: false });
  }

  function removeChip(key: MultiFilterKey | SingleFilterKey, value: string) {
    navigate(
      (multiFilterKeys as readonly string[]).includes(key)
        ? toggleFilterValue(current, key as MultiFilterKey, value)
        : setFilterValue(current, key as SingleFilterKey, null),
    );
  }

  function clearAll() {
    const next = new URLSearchParams();
    const query = current.get("q");
    const sort = current.get("sort");
    if (query) next.set("q", query);
    if (sort) next.set("sort", sort);
    navigate(next);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-ink/10 py-3">
        <p className="text-sm text-muted">
          <span className="font-semibold tabular-nums text-ink">{total}</span>{" "}
          {total === 1 ? "style" : "styles"}
        </p>
        <div className="flex items-center gap-2 lg:hidden">
          <Drawer
            description="Choose filters. Every change is saved in the page URL."
            title="Filter products"
            trigger={
              <Button aria-label="Filter products" variant="outline">
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                Filters
              </Button>
            }
          >
            <FilterPanel
              facets={facets}
              {...(hideCategory !== undefined ? { hideCategory } : {})}
              pathname={pathname}
            />
          </Drawer>
          <Drawer
            description="Choose how products are ordered."
            title="Sort products"
            trigger={
              <Button aria-label="Sort products" variant="outline">
                <SortAsc aria-hidden="true" className="size-4" />
                Sort
              </Button>
            }
          >
            <div className="grid gap-2">
              {sortOptions.map((option) => (
                <button
                  aria-pressed={(current.get("sort") ?? "relevance") === option.value}
                  className="focus-ring min-h-12 rounded-md border border-ink/10 px-4 text-left text-sm aria-pressed:border-gold aria-pressed:bg-gold/10"
                  key={option.value}
                  onClick={() =>
                    navigate(
                      setFilterValue(
                        current,
                        "sort",
                        option.value === "relevance" ? null : option.value,
                      ),
                    )
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Drawer>
        </div>
        <label className="hidden items-center gap-3 text-sm lg:flex">
          <span className="text-muted">Sort by</span>
          <select
            className="focus-ring min-h-11 rounded-md border border-ink/20 bg-paper px-3 font-medium"
            onChange={(event) =>
              navigate(
                setFilterValue(
                  current,
                  "sort",
                  event.target.value === "relevance" ? null : event.target.value,
                ),
              )
            }
            value={current.get("sort") ?? "relevance"}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2 py-4" aria-label="Active filters">
          {chips.map((chip) => (
            <button
              className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full bg-ivory px-3 text-xs font-semibold hover:bg-gold/15"
              key={`${chip.key}-${chip.value}`}
              onClick={() => removeChip(chip.key, chip.value)}
              type="button"
            >
              {chip.label}
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ))}
          <button
            className="focus-ring min-h-9 rounded-sm px-2 text-xs font-semibold underline underline-offset-4"
            onClick={clearAll}
            type="button"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}
