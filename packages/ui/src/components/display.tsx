import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-ink/7 text-ink",
        gold: "bg-gold text-ink",
        success: "bg-success/10 text-success",
        error: "bg-error/10 text-error",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export interface PriceProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number;
  currency?: "INR";
  locale?: string;
}

export function Price({
  amount,
  className,
  currency = "INR",
  locale = "en-IN",
  ...props
}: PriceProps) {
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount / 100);
  return (
    <span className={cn("font-semibold tabular-nums", className)} {...props}>
      {formatted}
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-ink/10 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
