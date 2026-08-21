import { ProtectedRoute } from "@/auth/protected-route";
import { OperationsList } from "@/components/admin/operations-list";

export default function InventoryAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "catalog_manager"]}>
      <OperationsList module="inventory" />
    </ProtectedRoute>
  );
}
