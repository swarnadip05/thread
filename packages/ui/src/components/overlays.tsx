"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "../lib/cn";
import { IconButton } from "./icon-button";

type RootProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;
interface OverlayPanelProps extends RootProps {
  children: ReactNode;
  description?: string;
  title: string;
  trigger?: ReactNode;
}

function Overlay({
  children,
  contentClassName,
  description,
  title,
  trigger,
  ...props
}: OverlayPanelProps & { contentClassName?: string }) {
  return (
    <DialogPrimitive.Root {...props}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-overlay bg-ink/55 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-overlay bg-paper p-6 shadow-raised outline-none",
            contentClassName,
          )}
        >
          <div className="mb-5 pr-10">
            <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton aria-label="Close" className="absolute right-3 top-3">
              <X aria-hidden="true" className="size-5" />
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Dialog(props: OverlayPanelProps) {
  return (
    <Overlay
      contentClassName="left-1/2 top-1/2 max-h-[85dvh] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg"
      {...props}
    />
  );
}

export interface SheetProps extends OverlayPanelProps {
  side?: "left" | "right";
}
export function Sheet({ side = "right", ...props }: SheetProps) {
  return (
    <Overlay
      contentClassName={cn(
        "inset-y-0 w-[min(24rem,88vw)] overflow-y-auto",
        side === "left" ? "left-0" : "right-0",
      )}
      {...props}
    />
  );
}

export function Drawer(props: OverlayPanelProps) {
  return (
    <Overlay
      contentClassName="inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      {...props}
    />
  );
}
