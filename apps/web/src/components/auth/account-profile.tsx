"use client";

import { Badge, Button } from "@thread/ui";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/auth-provider";
import Link from "next/link";

export function AccountProfile() {
  const auth = useAuth();
  const router = useRouter();
  return (
    <section className="rounded-lg border border-ink/10 bg-paper p-6 shadow-subtle sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Account profile
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome, {auth.user?.name}</h1>
        </div>
        <Badge variant={auth.user?.emailVerified ? "success" : "neutral"}>
          {auth.user?.emailVerified ? "Email verified" : "Email unverified"}
        </Badge>
      </div>
      <dl className="mt-8 grid gap-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="mt-1 font-medium">{auth.user?.email ?? "Not added"}</dd>
        </div>
        <div>
          <dt className="text-muted">Phone</dt>
          <dd className="mt-1 font-medium">{auth.user?.phone ?? "Not added"}</dd>
        </div>
      </dl>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/account/orders">Track orders</Link>
        </Button>
        <Button variant="outline" onClick={() => router.push("/account/change-password")}>
          Change password
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await auth.logout();
            router.replace("/");
          }}
        >
          Sign out
        </Button>
      </div>
    </section>
  );
}
