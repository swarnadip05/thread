export const multiFilterKeys = ["category", "size", "colour", "fit", "material"] as const;
export const singleFilterKeys = [
  "availability",
  "rating",
  "discount",
  "minPrice",
  "maxPrice",
] as const;
export type MultiFilterKey = (typeof multiFilterKeys)[number];
export type SingleFilterKey = (typeof singleFilterKeys)[number];

export type RawSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const sorts = new Set([
  "relevance",
  "newest",
  "price_low_high",
  "price_high_low",
  "discount",
  "rating",
]);

function first(value: string | readonly string[] | undefined): string {
  return typeof value === "string" ? value : (value?.[0] ?? "");
}

function list(value: string | readonly string[] | undefined): readonly string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      values
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 120),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function integer(
  value: string | readonly string[] | undefined,
  minimum: number,
  maximum: number,
): string | null {
  const source = first(value);
  if (!source) return null;
  const parsed = Number(source);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? String(parsed) : null;
}

export function normalizeDiscoveryParams(raw: RawSearchParams): URLSearchParams {
  const parameters = new URLSearchParams();
  for (const key of multiFilterKeys) {
    const values = list(raw[key]);
    if (values.length) parameters.set(key, values.join(","));
  }
  const page = integer(raw.page, 1, 10_000);
  if (page && page !== "1") parameters.set("page", page);
  const sort = first(raw.sort);
  if (sorts.has(sort) && sort !== "relevance") parameters.set("sort", sort);
  const query = first(raw.q).trim().slice(0, 120);
  if (query) parameters.set("q", query);
  const audience = first(raw.audience);
  if (["men", "women", "unisex", "accessories"].includes(audience))
    parameters.set("audience", audience);
  const availability = first(raw.availability);
  if (availability === "in_stock") parameters.set("availability", availability);
  for (const key of ["rating", "discount"] as const) {
    const value = integer(raw[key], 0, key === "rating" ? 5 : 100);
    if (value) parameters.set(key, value);
  }
  for (const key of ["minPrice", "maxPrice"] as const) {
    const value = integer(raw[key], 0, 100_000_000);
    if (value) parameters.set(key, value);
  }
  return parameters;
}

export function catalogueApiParams(
  parameters: URLSearchParams,
  fixed?: { audience?: string; category?: string; collection?: string },
): URLSearchParams {
  const api = new URLSearchParams(parameters);
  const query = api.get("q");
  api.delete("q");
  if (query) api.set("search", query);
  api.set("limit", "24");
  if (fixed?.audience) api.set("audience", fixed.audience);
  if (fixed?.category) api.set("category", fixed.category);
  if (fixed?.collection) api.set("collection", fixed.collection);
  return api;
}

export function toggleFilterValue(
  current: URLSearchParams,
  key: MultiFilterKey,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const values = new Set((next.get(key) ?? "").split(",").filter(Boolean));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  if (values.size) next.set(key, [...values].sort().join(","));
  else next.delete(key);
  next.delete("page");
  return next;
}

export function setFilterValue(
  current: URLSearchParams,
  key: SingleFilterKey | "sort",
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete("page");
  return next;
}

export function discoveryHref(pathname: string, parameters: URLSearchParams): string {
  const query = parameters.toString();
  return query ? `${pathname}?${query}` : pathname;
}
