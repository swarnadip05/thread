import { notFound } from "next/navigation";
import { BusinessContentPage } from "@/components/content/business-content-page";
import { ContactPage } from "@/components/content/contact-page";
import { SizeGuidePage } from "@/components/content/size-guide-page";
import { loadContentPage, loadPublicSettings } from "@/services/site-settings";

const allowedSlugs = new Set([
  "about",
  "contact",
  "faq",
  "shipping-delivery",
  "returns-exchanges",
  "size-guide",
  "privacy-policy",
  "terms-conditions",
]);

export async function generateMetadata({ params }: { params: Promise<{ contentSlug: string }> }) {
  const { contentSlug } = await params;
  const page = allowedSlugs.has(contentSlug) ? await loadContentPage(contentSlug) : null;
  return page ? { title: page.title, description: page.summary } : {};
}

export default async function ContentPageRoute({
  params,
}: {
  params: Promise<{ contentSlug: string }>;
}) {
  const { contentSlug } = await params;
  if (!allowedSlugs.has(contentSlug)) notFound();
  const page = await loadContentPage(contentSlug);
  if (!page) notFound();
  if (contentSlug === "contact")
    return <ContactPage page={page} settings={await loadPublicSettings()} />;
  if (contentSlug === "size-guide") return <SizeGuidePage page={page} />;
  return <BusinessContentPage page={page} />;
}
