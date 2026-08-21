import { ReviewModerationPanel } from "@/components/admin/review-moderation-panel";
import { AdminRoleGate } from "@/components/admin/admin-role-gate";

export default function AdminReviewsPage() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager", "support_agent"]}>
      <ReviewModerationPanel />
    </AdminRoleGate>
  );
}
