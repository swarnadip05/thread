import { notFound } from "next/navigation";

import { adminNavigation } from "@/components/admin/admin-navigation";
import { AdminRoleGate } from "@/components/admin/admin-role-gate";

export default async function AdminSectionPage({
  params,
}: {
  readonly params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = adminNavigation.find((candidate) => candidate.href === `/admin/${section}`);
  if (!item) notFound();
  return (
    <AdminRoleGate roles={item.roles}>
      <section className="grid min-h-96 place-items-center rounded-lg border border-paper/10 bg-paper/[0.045] p-8 text-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">{item.label}</p>
          <h1 className="mt-3 text-3xl font-semibold">Workspace ready</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-paper/60">
            This protected section is part of the admin shell. Its dedicated management workflow is
            intentionally outside the current phase.
          </p>
        </div>
      </section>
    </AdminRoleGate>
  );
}
