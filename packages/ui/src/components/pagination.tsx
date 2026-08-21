import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface PaginationProps {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}
export function Pagination({ currentPage, onPageChange, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <PageButton
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </PageButton>
      {pages.map((page) => (
        <PageButton
          aria-current={page === currentPage ? "page" : undefined}
          key={page}
          onClick={() => onPageChange(page)}
          className={page === currentPage ? "bg-ink text-paper" : undefined}
        >
          {page}
        </PageButton>
      ))}
      <PageButton
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </PageButton>
    </nav>
  );
}
function PageButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-11 place-items-center rounded-md text-sm font-medium outline-none hover:bg-ink/7 focus-visible:ring-3 focus-visible:ring-gold/40 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
