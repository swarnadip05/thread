import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell-container grid min-h-[55vh] place-items-center py-16 text-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">404</p>
        <h1 className="mt-3 text-3xl font-semibold">This page is no longer available</h1>
        <p className="mt-3 max-w-md text-muted">
          It may have moved, been discontinued, or never existed. Browse the current THREAD
          catalogue instead.
        </p>
        <Link
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-md bg-ink px-5 font-semibold text-paper"
          href="/"
        >
          Browse THREAD
        </Link>
      </div>
    </main>
  );
}
