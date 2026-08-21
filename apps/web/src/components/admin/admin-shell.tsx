"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@thread/types";
import { Badge, IconButton, Sheet } from "@thread/ui";
import { ChevronRight, Menu, Store } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useAuth } from "@/auth/auth-provider";

import { AdminCommandPalette } from "./admin-command-palette";
import { adminLabelForPath, adminNavigation, isAdminNavigationAllowed } from "./admin-navigation";
import { AdminNotificationButton } from "./admin-notification-button";
import { AdminUnsavedChangesProvider, useAdminUnsavedChanges } from "./admin-unsaved-changes";

interface AdminShellProps {
  readonly brandName: string;
  readonly children: ReactNode;
}

function AdminNav({
  onNavigate,
  roles,
  tone = "dark",
}: {
  readonly onNavigate?: () => void;
  readonly roles: readonly UserRole[];
  readonly tone?: "dark" | "light";
}) {
  const pathname = usePathname();
  const { confirmNavigation } = useAdminUnsavedChanges();
  return (
    <nav aria-label="Admin navigation" className="grid gap-1">
      {adminNavigation
        .filter((item) => isAdminNavigationAllowed(item, roles))
        .map((item) => {
          const Icon = item.icon;
          const selected =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40 ${
                selected
                  ? "bg-gold text-ink"
                  : tone === "dark"
                    ? "text-paper/70 hover:bg-paper/10 hover:text-paper"
                    : "text-ink/70 hover:bg-ivory hover:text-ink"
              }`}
              href={item.href}
              key={item.href}
              onClick={(event) => {
                if (!confirmNavigation()) event.preventDefault();
                else onNavigate?.();
              }}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

function AdminTopBar({ brandName }: { readonly brandName: string }) {
  const pathname = usePathname();
  const auth = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roles = auth.user?.roles ?? [];
  return (
    <header className="sticky top-0 z-header border-b border-paper/10 bg-[#171717]/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <Sheet
          onOpenChange={setMobileOpen}
          open={mobileOpen}
          side="left"
          title="Workspace"
          trigger={
            <IconButton
              aria-label="Open admin navigation"
              className="border border-paper/10 text-paper lg:hidden"
            >
              <Menu aria-hidden="true" className="size-5" />
            </IconButton>
          }
        >
          <div className="mb-7 font-black tracking-[0.16em] text-ink">{brandName} / ADMIN</div>
          <AdminNav onNavigate={() => setMobileOpen(false)} roles={roles} tone="light" />
        </Sheet>
        <div className="min-w-0 lg:hidden">
          <p className="truncate text-sm font-bold tracking-[0.12em] text-paper">{brandName}</p>
        </div>
        <div className="hidden min-w-0 items-center gap-2 text-sm text-paper/65 md:flex">
          <Link
            className="hover:text-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
            href="/admin"
          >
            Workspace
          </Link>
          <ChevronRight aria-hidden="true" className="size-4" />
          <span className="truncate text-paper">{adminLabelForPath(pathname)}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AdminCommandPalette roles={roles} />
          <Badge
            className="hidden border border-gold/25 bg-gold/15 text-gold sm:inline-flex"
            variant="neutral"
          >
            {process.env.NEXT_PUBLIC_APP_ENV ?? "development"}
          </Badge>
          <AdminNotificationButton />
          <Link
            aria-label="View storefront"
            className="hidden min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-paper/75 hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40 sm:flex"
            href="/"
          >
            <Store aria-hidden="true" className="size-4" />
            Storefront
          </Link>
          <span className="hidden max-w-38 truncate border-l border-paper/10 pl-3 text-sm text-paper/75 md:block">
            {auth.user?.name ?? "Admin"}
          </span>
        </div>
      </div>
    </header>
  );
}

function AdminShellContent({ brandName, children }: AdminShellProps) {
  const auth = useAuth();
  return (
    <div className="min-h-dvh bg-[#111111] text-paper">
      <aside className="fixed inset-y-0 left-0 z-header hidden w-64 border-r border-paper/10 bg-[#171717] p-4 lg:block">
        <Link
          className="mb-8 block rounded-sm px-3 py-2 font-black tracking-[0.16em] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
          href="/admin"
        >
          {brandName} <span className="text-gold">/ ADMIN</span>
        </Link>
        <AdminNav roles={auth.user?.roles ?? []} />
      </aside>
      <div className="lg:pl-64">
        <AdminTopBar brandName={brandName} />
        <main className="mx-auto w-full max-w-[110rem] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShell(props: AdminShellProps) {
  return (
    <AdminUnsavedChangesProvider>
      <AdminShellContent {...props} />
    </AdminUnsavedChangesProvider>
  );
}
