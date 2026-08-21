"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive, Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../lib/cn";

export const Accordion = AccordionPrimitive.Root;
export function AccordionItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-ink/10", className)} {...props} />;
}
export function AccordionTrigger({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex min-h-12 flex-1 items-center justify-between gap-4 py-3 text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-gold/40",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}
export function AccordionContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn("overflow-hidden pb-4 text-sm text-muted", className)}
      {...props}
    />
  );
}

export const Tabs = TabsPrimitive.Root;
export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex min-h-11 rounded-md bg-ink/6 p-1", className)}
      {...props}
    />
  );
}
export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded-sm px-4 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-gold/40 data-[state=active]:bg-paper data-[state=active]:shadow-subtle",
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 outline-none focus-visible:ring-3 focus-visible:ring-gold/40", className)}
      {...props}
    />
  );
}
