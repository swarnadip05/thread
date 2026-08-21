"use client";

import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductFacetValueDto, ProductFacetsDto } from "@thread/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
  Input,
} from "@thread/ui";

import {
  discoveryHref,
  setFilterValue,
  toggleFilterValue,
  type MultiFilterKey,
} from "@/discovery/url-state";

interface FilterGroup {
  readonly key: MultiFilterKey;
  readonly label: string;
  readonly options: readonly ProductFacetValueDto[];
}

function FilterOptions({
  filterKey,
  options,
  selected,
  onToggle,
}: {
  filterKey: MultiFilterKey;
  options: readonly ProductFacetValueDto[];
  selected: ReadonlySet<string>;
  onToggle: (key: MultiFilterKey, value: string) => void;
}) {
  if (!options.length) return <p className="py-2 text-xs">No options in this result set.</p>;
  return (
    <div className="grid gap-1">
      {options.map((option) => (
        <label
          className="flex min-h-10 cursor-pointer items-center gap-3 rounded-sm px-1 text-ink hover:bg-ivory"
          key={option.value}
        >
          <Checkbox
            checked={selected.has(option.value)}
            onCheckedChange={() => onToggle(filterKey, option.value)}
          />
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          <span className="text-xs tabular-nums text-muted">{option.count}</span>
        </label>
      ))}
    </div>
  );
}

export function FilterPanel({
  facets,
  hideCategory = false,
  pathname,
}: {
  facets: ProductFacetsDto;
  hideCategory?: boolean;
  pathname: string;
}) {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const current = new URLSearchParams(searchParameters.toString());
  const groups: readonly FilterGroup[] = [
    ...(!hideCategory
      ? [{ key: "category" as const, label: "Category", options: facets.categories }]
      : []),
    { key: "size", label: "Size", options: facets.sizes },
    { key: "colour", label: "Colour", options: facets.colours },
    { key: "fit", label: "Fit", options: facets.fits },
    { key: "material", label: "Material", options: facets.materials },
  ];

  function navigate(next: URLSearchParams) {
    router.push(discoveryHref(pathname, next), { scroll: false });
  }

  function toggle(key: MultiFilterKey, value: string) {
    navigate(toggleFilterValue(current, key, value));
  }

  function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minimum = Number(data.get("minimum"));
    const maximum = Number(data.get("maximum"));
    let next = setFilterValue(
      current,
      "minPrice",
      Number.isFinite(minimum) && minimum >= 0 ? String(Math.round(minimum * 100)) : null,
    );
    next = setFilterValue(
      next,
      "maxPrice",
      Number.isFinite(maximum) && maximum > 0 ? String(Math.round(maximum * 100)) : null,
    );
    navigate(next);
  }

  return (
    <Accordion
      className="w-full"
      defaultValue={["category", "size", "colour", "availability", "price"]}
      type="multiple"
    >
      {groups.map((group) => (
        <AccordionItem key={group.key} value={group.key}>
          <AccordionTrigger>{group.label}</AccordionTrigger>
          <AccordionContent>
            <FilterOptions
              filterKey={group.key}
              onToggle={toggle}
              options={group.options}
              selected={
                new Set(
                  (current.get(group.key) ?? "").split(",").map(decodeURIComponent).filter(Boolean),
                )
              }
            />
          </AccordionContent>
        </AccordionItem>
      ))}
      <AccordionItem value="availability">
        <AccordionTrigger>Availability</AccordionTrigger>
        <AccordionContent>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-ink">
            <Checkbox
              checked={current.get("availability") === "in_stock"}
              onCheckedChange={(checked) =>
                navigate(setFilterValue(current, "availability", checked ? "in_stock" : null))
              }
            />
            <span className="flex-1">In stock</span>
            <span className="text-xs tabular-nums text-muted">
              {facets.availability.find((item) => item.value === "in_stock")?.count ?? 0}
            </span>
          </label>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="price">
        <AccordionTrigger>Price</AccordionTrigger>
        <AccordionContent>
          <form className="grid grid-cols-2 gap-2 text-ink" onSubmit={submitPrice}>
            <label className="text-xs">
              Min ₹
              <Input
                className="mt-1"
                defaultValue={
                  current.get("minPrice") ? Number(current.get("minPrice")) / 100 : undefined
                }
                inputMode="numeric"
                min="0"
                name="minimum"
                placeholder="0"
                type="number"
              />
            </label>
            <label className="text-xs">
              Max ₹
              <Input
                className="mt-1"
                defaultValue={
                  current.get("maxPrice") ? Number(current.get("maxPrice")) / 100 : undefined
                }
                inputMode="numeric"
                min="0"
                name="maximum"
                placeholder={
                  facets.price.maxPaise ? String(Math.ceil(facets.price.maxPaise / 100)) : "Any"
                }
                type="number"
              />
            </label>
            <button
              className="focus-ring col-span-2 min-h-10 rounded-md bg-ink px-4 text-sm font-semibold text-paper"
              type="submit"
            >
              Apply price
            </button>
          </form>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="rating">
        <AccordionTrigger>Rating</AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            {facets.ratings.map((option) => (
              <label
                className="flex min-h-10 cursor-pointer items-center gap-3 text-ink"
                key={option.value}
              >
                <input
                  checked={current.get("rating") === option.value}
                  className="size-4 accent-gold"
                  name="rating"
                  onChange={() => navigate(setFilterValue(current, "rating", option.value))}
                  type="radio"
                />
                <span className="flex-1">{option.label} stars &amp; above</span>
                <span className="text-xs text-muted">{option.count}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="discount">
        <AccordionTrigger>Discount</AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-1">
            {facets.discounts.map((option) => (
              <label
                className="flex min-h-10 cursor-pointer items-center gap-3 text-ink"
                key={option.value}
              >
                <input
                  checked={current.get("discount") === option.value}
                  className="size-4 accent-gold"
                  name="discount"
                  onChange={() => navigate(setFilterValue(current, "discount", option.value))}
                  type="radio"
                />
                <span className="flex-1">{option.label}</span>
                <span className="text-xs text-muted">{option.count}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
