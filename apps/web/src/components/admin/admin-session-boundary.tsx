"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/auth/protected-route";
import { AdminShell } from "./admin-shell";

const roles = [
  "super_admin",
  "admin",
  "catalog_manager",
  "order_manager",
  "support_agent",
] as const;

export function AdminSessionBoundary({
  brandName,
  children,
}: {
  brandName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return children;
  return (
    <ProtectedRoute allowedRoles={roles}>
      <AdminShell brandName={brandName}>{children}</AdminShell>
    </ProtectedRoute>
  );
}
