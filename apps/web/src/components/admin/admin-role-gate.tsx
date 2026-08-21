"use client";

import type { UserRole } from "@thread/types";
import { ErrorState } from "@thread/ui";
import type { ReactNode } from "react";

import { useAuth } from "@/auth/auth-provider";

export function AdminRoleGate({
  children,
  roles,
}: {
  readonly children: ReactNode;
  readonly roles: readonly UserRole[];
}) {
  const { user } = useAuth();
  if (!user?.roles.some((role) => roles.includes(role)))
    return (
      <ErrorState
        description="Your role does not have access to this workspace section."
        title="Access restricted"
      />
    );
  return <>{children}</>;
}
