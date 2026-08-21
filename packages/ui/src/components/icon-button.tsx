import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function IconButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-grid size-11 shrink-0 transform-gpu place-items-center rounded-full text-ink transition-[transform,box-shadow,background-color,color,opacity] duration-normal ease-out hover:-translate-y-0.5 hover:bg-ink/7 hover:shadow-subtle active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      data-slot="icon-button"
      {...props}
    />
  );
}
