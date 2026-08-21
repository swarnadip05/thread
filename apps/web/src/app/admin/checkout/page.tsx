import { ProtectedRoute } from "@/auth/protected-route";
import { CheckoutAdmin } from "@/components/admin/checkout-admin";

export default function AdminCheckoutPage() {
  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin", "order_manager"]}>
      <CheckoutAdmin />
    </ProtectedRoute>
  );
}
