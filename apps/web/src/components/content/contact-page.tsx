import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ContentPageDto, PublicSiteSettingsDto } from "@thread/types";
import { Button } from "@thread/ui";
import { BusinessContentPage } from "./business-content-page";

export function ContactPage({
  page,
  settings,
}: {
  page: ContentPageDto;
  settings: PublicSiteSettingsDto;
}) {
  const address = [
    settings.addressLine1,
    settings.locality,
    settings.district,
    `${settings.city} ${settings.postalCode}`,
    settings.state,
    settings.country,
  ].join(", ");
  const enquiry = encodeURIComponent("Hello THREAD, I would like help with an enquiry. Thank you.");
  return (
    <>
      <BusinessContentPage page={page} />
      <section className="shell-container -mt-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <Button asChild className="min-h-14">
            <a href={`tel:${settings.phone.replaceAll(" ", "")}`}>
              <Phone aria-hidden="true" className="size-5" />
              Call {settings.phone}
            </a>
          </Button>
          <Button asChild className="min-h-14" variant="outline">
            <a href={`mailto:${settings.email}`}>
              <Mail aria-hidden="true" className="size-5" />
              Email THREAD
            </a>
          </Button>
          <Button asChild className="min-h-14 bg-success text-paper hover:bg-success/90">
            <a
              href={`https://wa.me/${settings.whatsappNumber}?text=${enquiry}`}
              rel="noreferrer"
              target="_blank"
            >
              <MessageCircle aria-hidden="true" className="size-5" />
              WhatsApp enquiry
            </a>
          </Button>
        </div>
        <div className="mt-10 grid gap-6 rounded-lg bg-charcoal p-6 text-paper sm:p-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Legal business details
            </p>
            <p className="mt-4 font-semibold">
              {settings.legalName} trading as {settings.brandName}
            </p>
          </div>
          <address className="not-italic text-sm leading-6 text-paper/65">
            <MapPin aria-hidden="true" className="mb-3 size-5 text-gold" />
            {address}
            <br />
            {settings.phone}
            <br />
            {settings.email}
          </address>
        </div>
      </section>
    </>
  );
}
