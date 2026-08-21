import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 transform-gpu items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold shadow-subtle transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-normal ease-out hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary: "bg-ink !text-white hover:bg-charcoal",
        gold: "bg-gold !text-ink hover:bg-gold/85",
        outline: "border border-ink/25 bg-white !text-ink hover:bg-ivory",
        ghost: "bg-transparent !text-ink shadow-none hover:bg-ink/6 hover:shadow-subtle",
        danger: "bg-error !text-white hover:bg-error/90",
      },
      size: { sm: "min-h-9 px-3", md: "min-h-11 px-5", lg: "min-h-12 px-6 text-base" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonVariants({ size, variant }), className)}
      data-slot="button"
      {...props}
    />
  );
}
