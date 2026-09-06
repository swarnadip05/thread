import Link from "next/link";
import type { HomepageSectionDto, ProductSummaryDto } from "@thread/types";
import { Camera, CreditCard, Headphones, RefreshCcw, Truck } from "lucide-react";

import { approvedAsset } from "@/services/approved-assets";
import { HomepageHero } from "./homepage-hero";
import { LazyNewsletter } from "./lazy-newsletter";
import { MediaFrame } from "./media-frame";
import { ProductRail } from "./product-rail";
import { SectionHeading } from "./section-heading";

const trustIcons = {
  card: CreditCard,
  headphones: Headphones,
  truck: Truck,
  refresh: RefreshCcw,
  instagram: Camera,
} as const;

function AudienceCards({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal shell-container py-12 sm:py-16">
      <SectionHeading align="center" section={section} />
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {section.items.map((item) => {
          const audience = item.id === "men" || item.id === "women" ? item.id : null;
          const image = item.image ?? approvedAsset("category", audience);
          const content = (
            <>
              <MediaFrame
                className="aspect-[4/3] sm:aspect-[16/11]"
                image={image}
                sizes="(max-width: 767px) 100vw, 50vw"
              />
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between rounded-md bg-paper/95 p-4 shadow-raised backdrop-blur-sm sm:inset-x-5 sm:bottom-5 sm:p-5">
                <div>
                  <h3 className="text-2xl font-black tracking-[0.08em]">{item.title}</h3>
                  {item.subtitle ? (
                    <p className="mt-1 text-sm text-muted">{item.subtitle}</p>
                  ) : null}
                </div>
                <span aria-hidden="true" className="text-2xl">
                  ↗
                </span>
              </div>
            </>
          );
          return item.href ? (
            <Link
              className="focus-ring group relative overflow-hidden rounded-lg"
              href={item.href}
              key={item.id}
            >
              {content}
            </Link>
          ) : (
            <article className="group relative overflow-hidden rounded-lg" key={item.id}>
              {content}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Categories({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal bg-ivory py-12 sm:py-16">
      <div className="shell-container">
        <SectionHeading align="center" section={section} />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {section.items.map((item, index) => (
            <Link
              className="focus-ring group rounded-lg bg-paper p-3 shadow-subtle"
              href={item.href ?? "/shop"}
              key={item.id}
            >
              <MediaFrame
                className="aspect-square rounded-md"
                image={item.image ?? approvedAsset("category")}
                sizes="(max-width: 639px) 50vw, 33vw"
              />
              <div className="flex items-center justify-between gap-3 px-2 py-4">
                <h3 className="font-semibold sm:text-lg">{item.title}</h3>
                <span className="text-xs font-bold text-muted">0{index + 1}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Collections({ section }: { section: HomepageSectionDto }) {
  const slugs = section.collectionSlugs;
  const hasItems = section.items.length > 0;
  if (!hasItems && !slugs.length && process.env.NODE_ENV !== "development") return null;
  return (
    <section className="homepage-reveal shell-container py-12 sm:py-16">
      <SectionHeading section={section} />
      {hasItems ? (
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {section.items.map((item) => (
            <Link
              className="focus-ring group relative overflow-hidden rounded-lg bg-charcoal text-paper"
              href={item.href ?? "/search"}
              key={item.id}
            >
              <MediaFrame
                className="aspect-[4/5] opacity-80"
                image={item.image ?? approvedAsset("campaign")}
                sizes="(max-width: 767px) 100vw, 33vw"
              />
              <div className="absolute inset-x-6 bottom-6">
                <h3 className="text-2xl font-semibold tracking-tight">{item.title}</h3>
                {item.subtitle ? (
                  <p className="mt-2 text-sm leading-5 text-paper/75">{item.subtitle}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : slugs.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {slugs.map((slug) => (
            <Link
              className="focus-ring group relative overflow-hidden rounded-lg bg-charcoal text-paper"
              href={`/collection/${slug}`}
              key={slug}
            >
              <MediaFrame
                className="aspect-[4/5] opacity-75"
                image={approvedAsset("campaign")}
                sizes="(max-width: 767px) 100vw, 33vw"
              />
              <h3 className="absolute inset-x-6 bottom-6 text-2xl font-semibold capitalize tracking-tight">
                {slug.replaceAll("-", " ")}
              </h3>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-9 rounded-lg border border-dashed border-ink/15 px-6 py-16 text-center">
          <p className="font-semibold">Curated collections are being prepared.</p>
          <p className="mt-2 text-sm text-muted">Published selections will appear here.</p>
        </div>
      )}
    </section>
  );
}

function Editorial({
  promotion,
  section,
}: {
  promotion?: HomepageSectionDto;
  section: HomepageSectionDto;
}) {
  const image = section.desktopImage ?? approvedAsset("campaign");
  return (
    <section className="homepage-reveal shell-container py-12 sm:py-16">
      <div className="grid overflow-hidden rounded-lg bg-charcoal text-paper lg:grid-cols-2">
        <MediaFrame
          className="aspect-[4/3] lg:aspect-auto lg:min-h-[32rem]"
          image={image}
          sizes="(max-width: 1023px) 100vw, 50vw"
        />
        <div className="flex items-center p-7 sm:p-10 lg:p-12">
          <div>
            {section.eyebrow ? (
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                {section.eyebrow}
              </p>
            ) : null}
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {section.title}
            </h2>
            {section.body ? (
              <p className="mt-6 max-w-lg leading-7 text-paper/65">{section.body}</p>
            ) : null}
            {section.primaryCta ? (
              <Link
                className="focus-ring mt-8 inline-flex min-h-11 items-center rounded-md border border-paper/30 px-5 text-sm font-semibold hover:bg-paper hover:text-ink"
                href={section.primaryCta.href}
              >
                {section.primaryCta.label}
              </Link>
            ) : null}
            {promotion?.primaryCta?.label && promotion.primaryCta.href ? (
              <div className="relative mt-9 overflow-hidden rounded-md bg-gold p-5 text-ink">
                <div className="absolute -right-10 -top-12 size-32 rounded-full border-[1.25rem] border-ink/8" />
                <p className="relative text-xs font-bold uppercase tracking-[0.18em]">
                  {promotion.eyebrow ?? "Explore THREAD"}
                </p>
                <p className="relative mt-2 text-xl font-semibold">{promotion.title}</p>
                {promotion.subtitle ? (
                  <p className="relative mt-2 text-sm leading-6 text-ink/70">
                    {promotion.subtitle}
                  </p>
                ) : null}
                <Link
                  className="focus-ring relative mt-5 inline-flex min-h-11 items-center rounded-md bg-ink px-5 text-sm font-bold text-paper hover:bg-charcoal"
                  href={promotion.primaryCta.href}
                >
                  {promotion.primaryCta.label}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandValues({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal overflow-hidden bg-ivory py-16 sm:py-20">
      <div className="shell-container grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
          {section.eyebrow}
        </p>
        <div>
          <h2 className="max-w-5xl text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl">
            {section.title}
          </h2>
          {section.body ? (
            <p className="mt-7 max-w-xl text-sm leading-6 text-ink/70">{section.body}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TrustFeatures({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal shell-container py-12 sm:py-16">
      <SectionHeading align="center" section={section} />
      <div className="mt-7 grid gap-px overflow-hidden rounded-lg bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
        {section.items.map((item) => {
          const Icon = item.icon ? trustIcons[item.icon] : RefreshCcw;
          return (
            <article className="bg-paper p-7" key={item.id}>
              <Icon aria-hidden="true" className="size-6 text-gold" strokeWidth={1.8} />
              <h3 className="mt-5 font-semibold">{item.title}</h3>
              {item.subtitle ? (
                <p className="mt-2 text-sm leading-6 text-muted">{item.subtitle}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Newsletter({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal bg-charcoal py-14 text-paper sm:py-18">
      <div className="shell-container grid gap-8 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            {section.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            {section.title}
          </h2>
          {section.subtitle ? <p className="mt-4 text-paper/65">{section.subtitle}</p> : null}
        </div>
        <LazyNewsletter />
      </div>
    </section>
  );
}

function Social({ section }: { section: HomepageSectionDto }) {
  return (
    <section className="homepage-reveal shell-container py-10 sm:py-12">
      <Camera aria-hidden="true" className="mx-auto size-6 text-gold" />
      <SectionHeading align="center" section={section} />
      {section.items.length ? (
        <div className="mx-auto mt-7 grid max-w-5xl gap-3 text-left md:grid-cols-3">
          {section.items.slice(0, 3).map((item) => {
            const isExternal = item.href?.startsWith("https://");
            const content = (
              <div className="flex h-full items-center justify-between gap-4 p-5">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.subtitle ? (
                    <p className="mt-1 text-sm leading-5 text-muted">{item.subtitle}</p>
                  ) : null}
                </div>
                <span aria-hidden="true" className="text-xl text-gold">
                  ↗
                </span>
              </div>
            );
            return isExternal ? (
              <a
                className="focus-ring rounded-lg border border-ink/10 bg-paper transition-colors hover:bg-ivory motion-reduce:transition-none"
                href={item.href}
                key={item.id}
                rel="noopener noreferrer"
                target="_blank"
              >
                {content}
              </a>
            ) : (
              <Link
                className="focus-ring rounded-lg border border-ink/10 bg-paper transition-colors hover:bg-ivory motion-reduce:transition-none"
                href={item.href ?? "/contact"}
                key={item.id}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-7 text-center text-sm font-medium text-muted">
          Verified story links will appear here.
        </p>
      )}
    </section>
  );
}

function customerSafeSection(section: HomepageSectionDto): HomepageSectionDto {
  if (
    section.type === "new_arrivals" &&
    (section.subtitle ===
      "A first look at current THREAD silhouettes. Final product details appear in the catalogue." ||
      section.subtitle === "The latest published styles from THREAD.")
  )
    return {
      ...section,
      subtitle: "Fresh styles, newly added.",
    };
  if (
    section.type === "best_sellers" &&
    (section.subtitle ===
      "A curated preview while verified order history determines the best-seller ranking." ||
      section.subtitle === "Popular published styles, ordered by customer ratings.")
  )
    return {
      ...section,
      subtitle: "Popular styles, ranked by delivered orders.",
    };
  if (section.type === "brand_values")
    return {
      ...section,
      title:
        section.title === "Designed for Comfort. Built to Last."
          ? "Designed for everyday comfort."
          : section.title,
      ...(section.body ===
      "This marketing statement requires client confirmation before production launch."
        ? { body: "Explore fits made for your rotation." }
        : {}),
    };
  if (section.type === "trust_features")
    return {
      ...section,
      items: section.items.map((item) =>
        item.id === "payments" || /payment|checkout/i.test(`${item.title} ${item.subtitle}`)
          ? {
              ...item,
              title: "Order on WhatsApp",
              subtitle: "Send your selected style and size directly to THREAD.",
              icon: "headphones",
            }
          : item,
      ),
    };
  return section;
}

export function HomepageSections({
  bestSellers,
  newArrivals,
  sections,
}: {
  bestSellers: readonly ProductSummaryDto[];
  newArrivals: readonly ProductSummaryDto[];
  sections: readonly HomepageSectionDto[];
}) {
  const content = sections.map(customerSafeSection);
  const section = (type: HomepageSectionDto["type"]) =>
    content.find((candidate) => candidate.type === type);
  const hero = section("hero");
  const audience = section("audience_cards");
  const categories = section("categories");
  const newArrivalsSection = section("new_arrivals");
  const editorial = section("editorial");
  const promotion = section("offer");
  const bestSellersSection = section("best_sellers");
  const collections = section("collections");
  const brandValues = section("brand_values");
  const trust = section("trust_features");
  const newsletter = section("newsletter");
  const social = section("social");

  return (
    <>
      {hero ? <HomepageHero section={hero} /> : <h1 className="sr-only">THREAD fashion</h1>}
      {audience ? <AudienceCards section={audience} /> : null}
      {categories ? <Categories section={categories} /> : null}
      {newArrivalsSection ? (
        <ProductRail products={newArrivals} section={newArrivalsSection} />
      ) : null}
      {editorial ? <Editorial {...(promotion ? { promotion } : {})} section={editorial} /> : null}
      {bestSellersSection ? (
        <ProductRail products={bestSellers} section={bestSellersSection} tone="ivory" />
      ) : null}
      {collections ? <Collections section={collections} /> : null}
      {brandValues ? <BrandValues section={brandValues} /> : null}
      {trust ? <TrustFeatures section={trust} /> : null}
      {newsletter ? <Newsletter section={newsletter} /> : null}
      {social ? <Social section={social} /> : null}
    </>
  );
}
