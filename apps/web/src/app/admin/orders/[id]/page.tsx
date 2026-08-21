import { ProtectedRoute } from "@/auth/protected-route";
import { OrderDetailAdmin } from "@/components/admin/order-detail-admin";

export default async function OrderAdminPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "order_manager", "support_agent"]}>
      <OrderDetailAdmin orderId={id} />
    </ProtectedRoute>
  );
}
