import { AdminRoleGate } from "@/components/admin/admin-role-gate";
import { ProductEditor } from "@/components/admin/product-editor";
export default function NewProductPage() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager"]}>
      <ProductEditor />
    </AdminRoleGate>
  );
}
