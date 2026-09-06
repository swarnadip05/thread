import { AdminRoleGate } from "@/components/admin/admin-role-gate";
import { TaxonomyAdmin } from "@/components/admin/taxonomy-admin";
export default function Page() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager"]}>
      <TaxonomyAdmin kind="categories" />
    </AdminRoleGate>
  );
}
