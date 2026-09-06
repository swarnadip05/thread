"use client";

import type { UserRole } from "@thread/types";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: readonly UserRole[];
  children: ReactNode;
}) {
  const { refresh, status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const refreshAttempted = useRef(false);
  const redirectedTo = useRef<string | null>(null);
  const allowedRoleKey = allowedRoles?.join(",") ?? "";

  useEffect(() => {
    if (status !== "unknown" || refreshAttempted.current) return;
    refreshAttempted.current = true;
    void refresh();
  }, [refresh, status]);

  const destination = useMemo(() => {
    if (status === "unknown") return null;
    if (status === "anonymous" || !user)
      return pathname.startsWith("/admin") ? "/admin/login" : "/auth/login";
    if (user.mustChangePassword && pathname !== "/account/change-password")
      return "/account/change-password";
    if (allowedRoleKey) {
      const roles = allowedRoleKey.split(",") as UserRole[];
      if (!user.roles.some((role) => roles.includes(role))) return "/account";
    }
    return "";
  }, [allowedRoleKey, pathname, status, user]);

  useEffect(() => {
    if (!destination || destination === pathname || redirectedTo.current === destination) return;
    redirectedTo.current = destination;
    router.replace(destination);
  }, [destination, pathname, router]);

  if (status !== "authenticated" || !user || destination)
    return (
      <div aria-live="polite" className="grid min-h-[20rem] place-items-center text-sm text-muted">
        Checking your secure session…
      </div>
    );
  return children;
}
