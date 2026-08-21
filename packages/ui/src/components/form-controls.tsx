import { Check, ChevronDown, Search } from "lucide-react";
import {
  Checkbox as CheckboxPrimitive,
  RadioGroup as RadioPrimitive,
  Select as SelectPrimitive,
} from "radix-ui";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "min-h-11 w-full rounded-md border border-ink/20 bg-paper px-3 text-base text-ink shadow-subtle outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <span className="relative block w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
      />
      <Input ref={ref} type="search" className={cn("pl-10", className)} {...props} />
    </span>
  ),
);
SearchInput.displayName = "SearchInput";

export function Checkbox({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-sm border border-ink/35 bg-paper text-ink outline-none focus-visible:ring-3 focus-visible:ring-gold/40 disabled:opacity-50 data-[state=checked]:border-gold data-[state=checked]:bg-gold",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check aria-hidden="true" className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn("grid gap-3", className)} {...props} />;
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        "grid size-5 place-items-center rounded-full border border-ink/40 bg-paper outline-none focus-visible:ring-3 focus-visible:ring-gold/40",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-ink" />
    </RadioPrimitive.Item>
  );
}

export interface SelectOption {
  label: string;
  value: string;
}
export interface SelectProps extends ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  ariaLabel: string;
  options: readonly SelectOption[];
  placeholder?: string;
}

export function Select({
  ariaLabel,
  options,
  placeholder = "Select an option",
  ...props
}: SelectProps) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-ink/20 bg-paper px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden="true" className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-overlay min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-ink/10 bg-paper p-1 shadow-raised"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-10 cursor-default select-none items-center rounded-sm py-2 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-ivory"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2">
                  <Check aria-hidden="true" className="size-4" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label className="text-sm font-medium text-ink" htmlFor={htmlFor}>
      {children}
    </label>
  );
}
