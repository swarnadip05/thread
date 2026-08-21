import type { SiteSettings } from "@/config/site-settings";
import Link from "next/link";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const address = [
    settings.addressLine1,
    settings.locality,
    settings.district,
    `${settings.city} ${settings.postalCode}`,
    settings.state,
    settings.country,
  ].join(", ");
  return (
    <footer className="bg-charcoal pb-20 text-paper lg:pb-0">
      <div className="shell-container py-10 lg:py-14">
        <div className="grid gap-9 border-b border-paper/15 pb-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_repeat(3,0.8fr)] lg:gap-12">
          <div>
            <p className="text-3xl font-black tracking-[0.16em]">{settings.brandName}</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-paper/65">
              Everyday styles from {settings.brandName}, operated by {settings.legalName}.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-paper/75">
              <a
                className="focus-ring w-fit rounded-sm hover:text-paper"
                href={`tel:${settings.phone.replaceAll(" ", "")}`}
              >
                {settings.phone}
              </a>
              <a
                className="focus-ring w-fit rounded-sm break-all hover:text-paper"
                href={`mailto:${settings.email}`}
              >
                {settings.email}
              </a>
            </div>
            {settings.socialLinks.length ? (
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-paper/75">
                {settings.socialLinks.map((link) => (
                  <a
                    className="focus-ring rounded-sm hover:text-paper"
                    href={link.href}
                    key={link.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          {settings.footerGroups.map((group) => (
            <section key={group.id}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                {group.title}
              </h2>
              <ul className="mt-4 grid gap-3 text-sm text-paper/65">
                {group.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      className="focus-ring rounded-sm underline-offset-4 hover:text-paper hover:underline"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="grid gap-6 pt-7 text-xs leading-5 text-paper/60 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-semibold text-paper/80">
              {settings.legalName}, trading as {settings.brandName}
            </p>
            <address className="mt-1 max-w-3xl not-italic">{address}</address>
          </div>
          <p className="lg:text-right">
            © {new Date().getFullYear()} {settings.legalName}. All rights reserved.
            <span className="mt-1 block">THREAD · Founded {settings.foundedYear}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
