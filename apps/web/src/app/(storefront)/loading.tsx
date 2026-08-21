import { Skeleton } from "@thread/ui";

export default function StorefrontLoading() {
  return (
    <div aria-label="Loading storefront" aria-live="polite">
      <Skeleton className="h-[35rem] w-full rounded-none sm:h-[39rem] lg:h-[42rem]" />
      <div className="shell-container py-12 sm:py-16">
        <Skeleton className="mx-auto h-9 w-64" />
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <Skeleton className="aspect-[4/3] sm:aspect-[16/11]" />
          <Skeleton className="aspect-[4/3] sm:aspect-[16/11]" />
        </div>
        <Skeleton className="mt-14 h-9 w-56" />
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Skeleton className="aspect-[4/5]" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-2 h-4 w-2/5" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading THREAD products and campaigns.</span>
    </div>
  );
}
