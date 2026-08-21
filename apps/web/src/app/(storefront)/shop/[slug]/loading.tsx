import { Skeleton } from "@thread/ui";

export default function ProductDetailLoading() {
  return (
    <main aria-busy="true" aria-label="Loading product" className="shell-container py-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] rounded-lg" />
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-11 w-4/5" />
          <Skeleton className="mt-4 h-5 w-40" />
          <Skeleton className="mt-8 h-28 w-full" />
          <Skeleton className="mt-5 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      </div>
    </main>
  );
}
