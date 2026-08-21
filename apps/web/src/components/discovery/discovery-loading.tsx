import { Skeleton } from "@thread/ui";

export function DiscoveryLoading() {
  return (
    <main className="shell-container py-10" aria-label="Loading products">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-3 h-12 w-64" />
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-[4/5]" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-2 h-4 w-2/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
