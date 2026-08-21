import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { loadPublicNavigation, loadPublicSettings } from "@/services/site-settings";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [navigation, settings] = await Promise.all([loadPublicNavigation(), loadPublicSettings()]);
  return (
    <StorefrontShell navigation={navigation} settings={settings}>
      {children}
    </StorefrontShell>
  );
}
