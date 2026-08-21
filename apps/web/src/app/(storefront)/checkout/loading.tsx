import { Skeleton } from "@thread/ui";

export default function CheckoutLoading() {
  return (
    <div className="shell-container grid gap-8 py-10 lg:grid-cols-[1fr_24rem]">
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
