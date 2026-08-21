"use client";

import type { UserRole } from "@thread/types";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: readonly UserRole[];
  children: ReactNode;
}) {
  const { refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    void refresh().then((session) => {
      if (!active) return;
      if (!session) router.replace("/auth/login");
      else if (session.user.mustChangePassword && pathname !== "/account/change-password")
        router.replace("/account/change-password");
      else if (allowedRoles && !session.user.roles.some((role) => allowedRoles.includes(role)))
        router.replace("/account");
      else setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [allowedRoles, pathname, refresh, router]);
  if (!checked)
    return (
      <div aria-live="polite" className="grid min-h-[20rem] place-items-center text-sm text-muted">
        Checking your secure session…
      </div>
    );
  return children;
}
