import { ProtectedRoute } from "@/auth/protected-route";
import { OperationsSettingsAdmin } from "@/components/admin/operations-settings-admin";

export default function SettingsAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
      <OperationsSettingsAdmin />
    </ProtectedRoute>
  );
}
