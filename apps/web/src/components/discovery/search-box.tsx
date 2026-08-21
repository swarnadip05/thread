"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApiResponse, ProductSearchSuggestionsDto } from "@thread/types";
import { SearchInput } from "@thread/ui";
import { Clock3, Search, X } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const recentSearchesKey = "thread:recent-searches";

function readRecentSearches(): readonly string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(recentSearchesKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export function SearchBox({
  autoFocus = false,
  placeholder,
}: {
  autoFocus?: boolean;
  placeholder: string;
}) {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<readonly string[]>([]);
  const [suggestions, setSuggestions] = useState<ProductSearchSuggestionsDto | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(
        `${apiUrl}/api/v1/catalog/search/suggestions?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) return null;
          const body = (await response.json()) as ApiResponse<ProductSearchSuggestionsDto>;
          return body.success ? body.data : null;
        })
        .then((result) => setSuggestions(result))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function remember(value: string) {
    const next = [
      value,
      ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase()),
    ].slice(0, 5);
    setRecent(next);
    window.localStorage.setItem(recentSearchesKey, JSON.stringify(next));
  }

  function search(value: string) {
    const cleaned = value.trim().slice(0, 120);
    if (!cleaned) return;
    remember(cleaned);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(cleaned)}`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    search(query);
  }

  const hasSuggestions =
    suggestions && (suggestions.products.length > 0 || suggestions.categories.length > 0);
  return (
    <form className="relative w-full" onSubmit={submit} role="search">
      <SearchInput
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-label="Search products"
        autoComplete="off"
        autoFocus={autoFocus}
        onChange={(event) => {
          setQuery(event.target.value);
          setSuggestions(null);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecentSearches());
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        role="combobox"
        value={query}
      />
      <button className="sr-only" type="submit">
        Search
      </button>
      {open && (query.trim().length >= 2 || recent.length > 0) ? (
        <div
          className="absolute inset-x-0 top-[calc(100%+.5rem)] z-overlay max-h-[min(32rem,70dvh)] overflow-y-auto rounded-lg border border-ink/10 bg-paper p-2 shadow-raised"
          id={listboxId}
          role="listbox"
        >
          {query.trim().length < 2 && recent.length ? (
            <div>
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  Recent searches
                </p>
                <button
                  className="focus-ring min-h-9 rounded-sm px-2 text-xs font-semibold underline"
                  onClick={() => {
                    setRecent([]);
                    window.localStorage.removeItem(recentSearchesKey);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
              {recent.map((item) => (
                <button
                  className="focus-ring flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-ivory"
                  key={item}
                  onClick={() => search(item)}
                  aria-selected="false"
                  role="option"
                  type="button"
                >
                  <Clock3 aria-hidden="true" className="size-4 text-muted" />
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {query.trim().length >= 2 ? (
            <>
              {hasSuggestions ? (
                <>
                  {suggestions.categories.length ? (
                    <div>
                      <p className="px-2 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                        Categories
                      </p>
                      {suggestions.categories.map((category) => (
                        <Link
                          className="focus-ring flex min-h-11 items-center gap-3 rounded-md px-3 text-sm hover:bg-ivory"
                          href={`/category/${category.slug}`}
                          key={category.slug}
                          onClick={() => setOpen(false)}
                          aria-selected="false"
                          role="option"
                        >
                          <Search aria-hidden="true" className="size-4 text-muted" />
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {suggestions.products.length ? (
                    <div>
                      <p className="px-2 py-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                        Products
                      </p>
                      {suggestions.products.map((product) => (
                        <Link
                          className="focus-ring block min-h-11 rounded-md px-3 py-2 text-sm hover:bg-ivory"
                          href={`/shop/${product.slug}`}
                          key={product.id}
                          onClick={() => setOpen(false)}
                          aria-selected="false"
                          role="option"
                        >
                          <span className="font-semibold">{product.title}</span>
                          <span className="ml-2 text-xs text-muted">
                            ₹{(product.minSalePricePaise / 100).toLocaleString("en-IN")}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : suggestions ? (
                <p className="px-3 py-5 text-sm text-muted">No suggestions found.</p>
              ) : (
                <p className="px-3 py-5 text-sm text-muted">Looking for matches…</p>
              )}
              <button
                className="focus-ring mt-1 flex min-h-11 w-full items-center gap-3 rounded-md bg-ivory px-3 text-left text-sm font-semibold"
                onClick={() => search(query)}
                aria-selected="false"
                role="option"
                type="button"
              >
                <Search aria-hidden="true" className="size-4" />
                Search for “{query.trim()}”
              </button>
            </>
          ) : null}
          <button
            aria-label="Close search suggestions"
            className="focus-ring absolute right-2 top-2 grid size-9 place-items-center rounded-full hover:bg-ivory"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
    </form>
  );
}
