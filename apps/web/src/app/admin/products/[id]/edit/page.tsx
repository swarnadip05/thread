import { AdminRoleGate } from "@/components/admin/admin-role-gate";
import { ProductEditor } from "@/components/admin/product-editor";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager"]}>
      <ProductEditor productId={id} />
    </AdminRoleGate>
  );
}
