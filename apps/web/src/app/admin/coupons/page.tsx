import { ProtectedRoute } from "@/auth/protected-route";
import { CouponsAdmin } from "@/components/admin/coupons-admin";

export default function CouponsAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "catalog_manager"]}>
      <CouponsAdmin />
    </ProtectedRoute>
  );
}
