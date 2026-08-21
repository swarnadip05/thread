import type { PublicNavigationDto, PublicSiteSettingsDto } from "@thread/types";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WhatsAppLink } from "./whatsapp-link";

export function StorefrontShell({
  children,
  navigation,
  settings,
}: Readonly<{
  children: React.ReactNode;
  navigation: PublicNavigationDto;
  settings: PublicSiteSettingsDto;
}>) {
  return (
    <div className="min-h-dvh bg-paper">
      <a
        className="fixed left-3 top-3 z-toast -translate-y-24 rounded-md bg-gold px-4 py-3 font-semibold text-ink focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <SiteHeader navigation={navigation} settings={settings} />
      <main className="pb-18 lg:pb-0" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter settings={settings} />
      <WhatsAppLink number={settings.whatsappNumber} />
    </div>
  );
}
