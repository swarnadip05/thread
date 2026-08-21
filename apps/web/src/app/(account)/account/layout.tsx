import Link from "next/link";
import { getSiteSettings } from "@/services/site-settings";
import { ProtectedRoute } from "@/auth/protected-route";

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = getSiteSettings();
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="border-b border-ink/10 bg-paper">
        <div className="shell-container flex h-18 items-center justify-between">
          <Link className="focus-ring rounded-sm text-xl font-black tracking-[0.16em]" href="/">
            {settings.brandName}
          </Link>
          <Link
            className="focus-ring rounded-sm text-sm font-semibold underline-offset-4 hover:underline"
            href="/"
          >
            Back to store
          </Link>
        </div>
      </header>
      <main className="shell-container py-10">
        <ProtectedRoute>{children}</ProtectedRoute>
      </main>
    </div>
  );
}
