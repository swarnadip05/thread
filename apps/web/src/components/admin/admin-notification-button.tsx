"use client";

import type { NotificationCreatedEvent, NotificationPageDto } from "@thread/types";
import { Badge, Dialog, IconButton, Skeleton } from "@thread/ui";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/auth/auth-client";
import { useAuth } from "@/auth/auth-provider";
import { useRealtime } from "@/realtime/realtime-provider";

export function AdminNotificationButton() {
  const { accessToken } = useAuth();
  const realtime = useRealtime();
  const [page, setPage] = useState<NotificationPageDto | null>(null);
  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setPage(await apiRequest<NotificationPageDto>("/notifications", accessToken));
    } catch {
      setPage({ items: [], unreadCount: 0 });
    }
  }, [accessToken]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
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
  return (
    <Dialog
      title="Notifications"
      trigger={
        <span className="relative">
          <IconButton
            aria-label="Open notifications"
            className="border border-paper/10 text-paper hover:bg-paper/10"
          >
            <Bell aria-hidden="true" className="size-4" />
          </IconButton>
          {page?.unreadCount ? (
            <Badge className="absolute -right-2 -top-2 min-w-5 justify-center px-1" variant="gold">
              {page.unreadCount > 9 ? "9+" : page.unreadCount}
            </Badge>
          ) : null}
        </span>
      }
    >
      {!page ? (
        <Skeleton className="h-24 w-full" />
      ) : page.items.length ? (
        <ul className="divide-y divide-ink/10">
          {page.items.slice(0, 8).map((item) => (
            <li className="py-3" key={item.id}>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.message}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">You are all caught up.</p>
      )}
    </Dialog>
  );
}
