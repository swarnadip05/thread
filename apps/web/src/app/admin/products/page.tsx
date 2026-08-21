import { AdminRoleGate } from "@/components/admin/admin-role-gate";
import { ProductsAdmin } from "@/components/admin/products-admin";

export default function AdminProductsPage() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager"]}>
      <ProductsAdmin />
    </AdminRoleGate>
  );
}
