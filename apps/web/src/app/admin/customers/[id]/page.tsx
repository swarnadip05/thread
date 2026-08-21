import { ProtectedRoute } from "@/auth/protected-route";
import { CustomerDetailAdmin } from "@/components/admin/customer-detail-admin";

export default async function CustomerAdminPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "order_manager", "support_agent"]}>
      <CustomerDetailAdmin customerId={id} />
    </ProtectedRoute>
  );
}
