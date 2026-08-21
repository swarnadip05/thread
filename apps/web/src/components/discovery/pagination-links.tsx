import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { discoveryHref } from "@/discovery/url-state";

export function PaginationLinks({
  currentPage,
  parameters,
  pathname,
  totalPages,
}: {
  currentPage: number;
  parameters: URLSearchParams;
  pathname: string;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index).filter(
    (page) => page <= totalPages,
  );
  const href = (page: number) => {
    const next = new URLSearchParams(parameters);
    if (page === 1) next.delete("page");
    else next.set("page", String(page));
    return discoveryHref(pathname, next);
  };
  return (
    <nav aria-label="Product pages" className="mt-14 flex items-center justify-center gap-1">
      {currentPage > 1 ? (
        <Link
          aria-label="Previous page"
          className="focus-ring grid size-11 place-items-center rounded-md hover:bg-ivory"
          href={href(currentPage - 1)}
          rel="prev"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
      {pages.map((page) => (
        <Link
          aria-current={page === currentPage ? "page" : undefined}
          className="focus-ring grid size-11 place-items-center rounded-md text-sm font-semibold hover:bg-ivory aria-[current=page]:bg-ink aria-[current=page]:text-paper"
          href={href(page)}
          key={page}
        >
          {page}
        </Link>
      ))}
      {currentPage < totalPages ? (
        <Link
          aria-label="Next page"
          className="focus-ring grid size-11 place-items-center rounded-md hover:bg-ivory"
          href={href(currentPage + 1)}
          rel="next"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
