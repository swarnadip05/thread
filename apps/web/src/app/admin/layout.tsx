import { getSiteSettings } from "@/services/site-settings";
import { ProtectedRoute } from "@/auth/protected-route";
import { AdminShell } from "@/components/admin/admin-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = getSiteSettings();
  return (
    <ProtectedRoute
      allowedRoles={["super_admin", "admin", "catalog_manager", "order_manager", "support_agent"]}
    >
      <AdminShell brandName={settings.brandName}>{children}</AdminShell>
    </ProtectedRoute>
  );
}
