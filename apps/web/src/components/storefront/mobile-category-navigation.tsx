"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Sheet } from "@thread/ui";
import type { NavigationItemDto } from "@thread/types";
import Link from "next/link";
import type { ReactNode } from "react";

export function MobileCategoryNavigation({
  children,
  items,
  onOpenChange,
  open,
}: {
  children?: ReactNode;
  items: readonly NavigationItemDto[];
  onOpenChange(open: boolean): void;
  open: boolean;
}) {
  return (
    <Sheet
      description="Explore THREAD departments."
      onOpenChange={onOpenChange}
      open={open}
      side="left"
      title="Shop categories"
      trigger={children}
    >
      <nav aria-label="Mobile categories">
        <Accordion className="w-full" type="multiple">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-base tracking-wide">{item.label}</AccordionTrigger>
              <AccordionContent className="pb-5 text-ink">
                <Link
                  className="focus-ring mb-2 block min-h-11 rounded-sm bg-ivory px-3 py-3 text-sm font-semibold"
                  href={`/${item.audience}`}
                  onClick={() => onOpenChange(false)}
                >
                  Shop all {item.label}
                </Link>
                <Accordion collapsible type="single">
                  {item.groups.map((group) => (
                    <AccordionItem key={group.id} value={group.id}>
                      <AccordionTrigger className="text-sm">{group.heading}</AccordionTrigger>
                      <AccordionContent>
                        <ul className="grid gap-1">
                          {group.links.map((link) => (
                            <li key={link.id}>
                              <Link
                                className="focus-ring block min-h-11 rounded-sm px-2 py-3 text-sm text-muted hover:bg-ivory hover:text-ink"
                                href={link.href}
                                onClick={() => onOpenChange(false)}
                              >
                                {link.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </nav>
    </Sheet>
  );
}
