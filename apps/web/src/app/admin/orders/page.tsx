import { ProtectedRoute } from "@/auth/protected-route";
import { OperationsList } from "@/components/admin/operations-list";

export default function OrdersAdminPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "order_manager", "support_agent"]}>
      <OperationsList module="orders" />
    </ProtectedRoute>
  );
}
