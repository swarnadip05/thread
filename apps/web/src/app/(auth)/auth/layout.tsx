import Link from "next/link";
import { getSiteSettings } from "@/services/site-settings";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = getSiteSettings();
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(22rem,0.85fr)_minmax(34rem,1.15fr)]">
      <aside className="relative hidden min-h-dvh overflow-hidden bg-charcoal p-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <Link
          className="focus-ring relative z-raised w-fit rounded-sm text-2xl font-black tracking-[0.18em]"
          href="/"
        >
          {settings.brandName}
        </Link>
        <div aria-hidden="true" className="absolute inset-0 opacity-60">
          <div className="absolute -left-28 top-1/3 size-96 rounded-full border-[5rem] border-gold/20" />
          <div className="absolute -right-20 bottom-1/4 h-1 w-[34rem] -rotate-45 bg-gold" />
          <div className="absolute -right-8 bottom-[28%] h-px w-[40rem] -rotate-45 bg-paper/30" />
        </div>
        <div className="relative z-raised max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Your THREAD account
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-[-0.04em]">
            Your style,
            <br />
            kept together.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-paper/65">
            Save favourites, manage your profile and follow orders from one secure place.
          </p>
        </div>
        <p className="relative z-raised text-xs text-paper/45">
          {settings.legalName} · {settings.city}
        </p>
      </aside>
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between border-b border-ink/10 px-5 lg:px-10">
          <Link
            className="focus-ring rounded-sm text-lg font-black tracking-[0.16em] lg:hidden"
            href="/"
          >
            {settings.brandName}
          </Link>
          <Link
            className="focus-ring ml-auto rounded-sm text-sm font-medium underline-offset-4 hover:underline"
            href="/"
          >
            Back to store
          </Link>
        </header>
        <main className="grid flex-1 place-items-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
