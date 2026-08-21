import { HomepageAdmin } from "@/components/admin/homepage-admin";
import { AdminRoleGate } from "@/components/admin/admin-role-gate";

export default function AdminHomepagePage() {
  return (
    <AdminRoleGate roles={["super_admin", "admin", "catalog_manager"]}>
      <HomepageAdmin />
    </AdminRoleGate>
  );
}
