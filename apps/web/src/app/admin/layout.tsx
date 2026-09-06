import { getSiteSettings } from "@/services/site-settings";
import { AdminSessionBoundary } from "@/components/admin/admin-session-boundary";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = getSiteSettings();
  return <AdminSessionBoundary brandName={settings.brandName}>{children}</AdminSessionBoundary>;
}
