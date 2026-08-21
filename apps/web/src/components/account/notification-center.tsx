"use client";

import Link from "next/link";
import type { NotificationCreatedEvent, NotificationPageDto } from "@thread/types";
import { Badge, Button, EmptyState, ErrorState, Skeleton } from "@thread/ui";
import { Bell, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { fallbackPollingInterval } from "@/realtime/polling";
import { useRealtime } from "@/realtime/realtime-provider";

export function NotificationCenter() {
  const auth = useAuth();
  const realtime = useRealtime();
  const [page, setPage] = useState<NotificationPageDto | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const next = await apiRequest<NotificationPageDto>("/notifications", auth.accessToken);
      setPage(next);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Notifications are unavailable.");
    }
  }, [auth.accessToken]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(
      () => void load(),
      fallbackPollingInterval(realtime.connected),
    );
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, realtime.connected]);

  useEffect(() => {
    const socket = realtime.socket;
    if (!socket) return;
    const created = (event: NotificationCreatedEvent) =>
      setPage((current) =>
        current && !current.items.some((item) => item.id === event.notification.id)
          ? {
              ...current,
              items: [event.notification, ...current.items],
              unreadCount: current.unreadCount + 1,
            }
          : current,
      );
    socket.on("notification.created", created);
    return () => {
      socket.off("notification.created", created);
    };
  }, [realtime.socket]);

  const markRead = async (id: string) => {
    if (!auth.accessToken) return;
    await apiRequest(`/notifications/${id}/read`, auth.accessToken, { method: "POST" });
    setPage((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
            ),
            unreadCount: Math.max(0, current.unreadCount - 1),
          }
        : current,
    );
  };

  if (!page)
    return error ? (
      <ErrorState className="mt-8" description={error} title="Notifications unavailable" />
    ) : (
      <section aria-label="Notifications" className="mt-8 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </section>
    );

  return (
    <section aria-labelledby="notifications-heading" className="mt-10">
      <div className="flex items-center gap-3">
        <Bell aria-hidden="true" className="size-5" />
        <h2 className="text-xl font-semibold" id="notifications-heading">
          Notifications
        </h2>
        <Badge variant={page.unreadCount ? "gold" : "neutral"}>{page.unreadCount} unread</Badge>
        <span className="ml-auto text-xs text-muted">
          {realtime.connected ? "Live" : "Polling fallback"}
        </span>
      </div>
      {page.items.length ? (
        <ul className="mt-4 divide-y divide-ink/10 rounded-lg border border-ink/10 bg-paper">
          {page.items.map((item) => (
            <li className="flex gap-4 p-4" key={item.id}>
              <div className="min-w-0 flex-1">
                {item.href ? (
                  <Link className="font-semibold hover:underline" href={item.href}>
                    {item.title}
                  </Link>
                ) : (
                  <p className="font-semibold">{item.title}</p>
                )}
                <p className="mt-1 text-sm text-muted">{item.message}</p>
                <time className="mt-2 block text-xs text-muted" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </time>
              </div>
              {!item.readAt ? (
                <Button onClick={() => void markRead(item.id)} size="sm" variant="outline">
                  <Check aria-hidden="true" className="size-4" /> Mark read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-4"
          description="Order and account updates will appear here."
          title="No notifications yet"
        />
      )}
      {error ? (
        <p aria-live="polite" className="mt-3 text-sm text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
