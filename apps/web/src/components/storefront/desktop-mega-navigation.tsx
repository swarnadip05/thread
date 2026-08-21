"use client";

import type { NavigationItemDto } from "@thread/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function DesktopMegaNavigation({ items }: { items: readonly NavigationItemDto[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const activeItem = items.find((item) => item.id === activeId) ?? null;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setActiveId(null), 180);
  };
  const open = (id: string) => {
    cancelClose();
    setActiveId(id);
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeId) {
        const index = items.findIndex((item) => item.id === activeId);
        setActiveId(null);
        triggers.current[index]?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [activeId, items]);

  const onTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    item: NavigationItemDto,
  ) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + direction + items.length) % items.length;
      triggers.current[next]?.focus();
      open(items[next]!.id);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open(item.id);
      requestAnimationFrame(() =>
        document.querySelector<HTMLAnchorElement>(`#mega-panel-${item.id} a`)?.focus(),
      );
    }
  };

  return (
    <nav
      aria-label="Primary navigation"
      className="flex h-full items-center gap-1"
      onPointerEnter={cancelClose}
      onPointerLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
      }}
    >
      {items.map((item, index) => (
        <button
          aria-controls={`mega-panel-${item.id}`}
          aria-expanded={activeId === item.id}
          className="focus-ring h-full rounded-sm border-b-3 border-transparent px-3 text-sm font-semibold tracking-wide hover:bg-ivory aria-expanded:border-gold"
          key={item.id}
          onClick={() => open(item.id)}
          onFocus={() => open(item.id)}
          onKeyDown={(event) => onTriggerKeyDown(event, index, item)}
          onPointerEnter={() => open(item.id)}
          ref={(node) => {
            triggers.current[index] = node;
          }}
          type="button"
        >
          {item.label}
        </button>
      ))}
      {activeItem ? (
        <div
          aria-label={`${activeItem.label} categories`}
          className="absolute inset-x-0 top-full z-overlay border-y border-ink/10 bg-paper shadow-raised"
          id={`mega-panel-${activeItem.id}`}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          role="region"
        >
          <div
            className="shell-container grid min-h-64 gap-10 py-8"
            style={{
              gridTemplateColumns: `repeat(${Math.min(activeItem.groups.length, 4)}, minmax(0, 1fr))${activeItem.promotionalTile ? " minmax(15rem, 1.2fr)" : ""}`,
            }}
          >
            {activeItem.groups.map((group) => (
              <section key={group.id}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  {group.heading}
                </h2>
                <ul className="mt-5 grid gap-3">
                  {group.links.map((link) => (
                    <li key={link.id}>
                      <Link
                        className="focus-ring inline-block rounded-sm text-sm font-medium underline-offset-4 hover:underline"
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {activeItem.promotionalTile ? (
              <Link
                className="focus-ring group relative min-h-48 overflow-hidden rounded-md bg-ivory"
                href={activeItem.promotionalTile.href}
              >
                <Image
                  alt={activeItem.promotionalTile.alt}
                  className="object-cover transition-transform duration-slow group-hover:scale-[1.02] motion-reduce:transition-none"
                  fill
                  sizes="320px"
                  src={activeItem.promotionalTile.imageUrl}
                />
                <span className="absolute inset-x-3 bottom-3 rounded-sm bg-paper/92 px-3 py-2 text-sm font-semibold">
                  {activeItem.promotionalTile.label}
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
