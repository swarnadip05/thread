"use client";

import { useEffect, useState } from "react";

export function ReservationTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired(): void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(timer);
        onExpired();
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpired]);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span aria-live="polite" className="font-mono font-semibold">
      {minutes}:{String(seconds).padStart(2, "0")}
    </span>
  );
}
