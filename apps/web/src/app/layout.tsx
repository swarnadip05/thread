import { ToastProvider } from "@thread/ui";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/auth/auth-provider";
import { RealtimeProvider } from "@/realtime/realtime-provider";
import { AnalyticsProvider } from "@/analytics/analytics-provider";
import { ConsentBanner } from "@/analytics/consent-banner";
import { absoluteUrl, jsonLd, siteUrl } from "@/seo/site";
import { getSiteSettings } from "@/services/site-settings";

const businessSettings = getSiteSettings();
export const metadata: Metadata = {
  title: {
    default: businessSettings.brandName,
    template: `%s — ${businessSettings.brandName}`,
  },
  description: `${businessSettings.brandName} fashion by ${businessSettings.legalName}.`,
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: businessSettings.brandName,
    url: siteUrl,
  },
  twitter: { card: "summary_large_image" },
};

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
    >
      <body>
        <ToastProvider>
          <AnalyticsProvider>
            <AuthProvider>
              <RealtimeProvider>{children}</RealtimeProvider>
            </AuthProvider>
            <ConsentBanner />
          </AnalyticsProvider>
        </ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: businessSettings.brandName,
                  legalName: businessSettings.legalName,
                  url: siteUrl,
                  email: businessSettings.email,
                  telephone: businessSettings.phone,
                },
                {
                  "@type": "WebSite",
                  name: businessSettings.brandName,
                  url: siteUrl,
                  potentialAction: {
                    "@type": "SearchAction",
                    target: `${absoluteUrl("/search")}?q={search_term_string}`,
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
          type="application/ld+json"
        />
      </body>
    </html>
  );
}
