import { ClientReviewBanner } from "@/components/admin/client-review-banner";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminRoleGate } from "@/components/admin/admin-role-gate";

export default function AdminPage() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "order_manager"]}>
      <ClientReviewBanner />
      <AdminDashboard />
    </AdminRoleGate>
  );
}
