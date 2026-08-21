"use client";

import { AlertCircle, CheckCircle2, Inbox, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { IconButton } from "./icon-button";

interface StateProps {
  action?: ReactNode;
  className?: string;
  description: string;
  title: string;
}
export function EmptyState({ action, className, description, title }: StateProps) {
  return (
    <section
      className={cn(
        "grid justify-items-center rounded-lg border border-dashed border-ink/20 bg-paper p-8 text-center",
        className,
      )}
    >
      <Inbox aria-hidden="true" className="size-8 text-muted" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
export function ErrorState({ action, className, description, title }: StateProps) {
  return (
    <section
      role="alert"
      className={cn(
        "grid justify-items-center rounded-lg border border-error/25 bg-error/5 p-8 text-center",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="size-8 text-error" />
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

interface ToastData {
  description?: string;
  id: number;
  title: string;
  variant?: "default" | "success" | "error";
}
interface ToastContextValue {
  toast: (input: Omit<ToastData, "id">) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((item) => item.id !== id)),
    [],
  );
  const toast = useCallback(
    (input: Omit<ToastData, "id">) => {
      const id = Date.now();
      setToasts((current) => [...current, { ...input, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-toast grid w-[min(24rem,calc(100%-2rem))] gap-2"
        role="region"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className={cn(
              "relative rounded-md border border-ink/10 bg-charcoal p-4 pr-12 text-paper shadow-raised",
              item.variant === "success" && "border-success",
              item.variant === "error" && "border-error",
            )}
          >
            <div className="flex gap-3">
              {item.variant === "success" ? (
                <CheckCircle2 aria-hidden="true" className="size-5 text-gold" />
              ) : null}
              <div>
                <p className="font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-sm text-paper/70">{item.description}</p>
                ) : null}
              </div>
            </div>
            <IconButton
              aria-label="Dismiss notification"
              className="absolute right-1 top-1 text-paper hover:bg-paper/10"
              onClick={() => dismiss(item.id)}
            >
              <X aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return <Button onClick={onClick}>Try again</Button>;
}
