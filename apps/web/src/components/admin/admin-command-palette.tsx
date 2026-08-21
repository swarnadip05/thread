"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { Dialog, SearchInput } from "@thread/ui";
import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@thread/types";

import { adminNavigation, isAdminNavigationAllowed } from "./admin-navigation";
import { useAdminUnsavedChanges } from "./admin-unsaved-changes";

interface AdminCommandPaletteProps {
  readonly roles: readonly UserRole[];
}

export function AdminCommandPalette({ roles }: AdminCommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { confirmNavigation } = useAdminUnsavedChanges();
  const items = useMemo(
    () =>
      adminNavigation.filter(
        (item) =>
          isAdminNavigationAllowed(item, roles) &&
          item.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, roles],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      open={open}
      title="Jump to section"
      trigger={
        <button
          className="hidden min-h-10 items-center gap-3 rounded-md border border-paper/10 bg-paper/5 px-3 text-left text-sm text-paper/60 transition hover:bg-paper/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40 md:flex"
          type="button"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="min-w-40">Search workspace</span>
          <kbd className="ml-auto rounded border border-paper/15 px-1.5 py-0.5 text-xs">⌘K</kbd>
        </button>
      }
    >
      <SearchInput
        aria-label="Search admin sections"
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search sections…"
        value={query}
      />
      <ul className="mt-4 grid gap-1" role="listbox">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-ivory focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
                href={item.href}
                onClick={(event) => {
                  if (!confirmNavigation()) event.preventDefault();
                  else setOpen(false);
                }}
                role="option"
              >
                <Icon aria-hidden="true" className="size-4 text-muted" />
                {item.label}
              </Link>
            </li>
          );
        })}
        {!items.length ? (
          <li className="px-3 py-6 text-center text-sm text-muted">No section found.</li>
        ) : null}
      </ul>
    </Dialog>
  );
}
