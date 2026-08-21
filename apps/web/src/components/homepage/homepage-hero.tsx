import { getImageProps } from "next/image";
import Link from "next/link";
import type { HomepageImageDto, HomepageSectionDto } from "@thread/types";
import { ArrowDownRight } from "lucide-react";

import { approvedAsset } from "@/services/approved-assets";

function ArtDirectedImage({
  desktop,
  mobile,
}: {
  desktop: HomepageImageDto;
  mobile: HomepageImageDto;
}) {
  const common = { alt: desktop.alt, quality: 88, sizes: "100vw" };
  const {
    props: { srcSet: desktopSrcSet, ...desktopProps },
  } = getImageProps({
    ...common,
    src: desktop.src,
    width: desktop.width,
    height: desktop.height,
  });
  const {
    props: { srcSet: mobileSrcSet },
  } = getImageProps({
    ...common,
    alt: mobile.alt,
    src: mobile.src,
    width: mobile.width,
    height: mobile.height,
  });
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={mobileSrcSet} />
      <source media="(min-width: 768px)" srcSet={desktopSrcSet} />
      {/* getImageProps provides Next.js-optimized art-directed srcsets. */}
      <img
        {...desktopProps}
        alt={desktop.alt}
        className="absolute inset-0 size-full object-cover object-[58%_20%] sm:object-[62%_24%]"
        fetchPriority="high"
      />
    </picture>
  );
}

export function HomepageHero({ section }: { section: HomepageSectionDto }) {
  const fallback = approvedAsset("hero") ?? approvedAsset("campaign");
  const desktop = section.desktopImage ?? fallback;
  const mobile = section.mobileImage ?? desktop;

  return (
    <section
      aria-labelledby={`${section.id}-title`}
      className="relative isolate min-h-[35rem] overflow-hidden bg-charcoal text-paper sm:min-h-[39rem] lg:min-h-[42rem]"
    >
      {desktop && mobile ? (
        <ArtDirectedImage desktop={desktop} mobile={mobile} />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(232,185,35,0.24),transparent_26%),linear-gradient(135deg,#111_0%,#252525_58%,#151515_100%)]">
          <div className="absolute -right-24 top-20 size-80 rounded-full border border-paper/10 sm:size-[30rem]" />
          <div className="absolute -bottom-40 right-[18%] size-96 rotate-12 border border-gold/20" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-ink/76 via-ink/34 to-transparent max-md:bg-gradient-to-t max-md:from-ink/88 max-md:via-ink/25 max-md:to-transparent" />
      <div className="shell-container relative flex min-h-[35rem] items-end py-11 sm:min-h-[39rem] sm:py-14 lg:min-h-[42rem] lg:items-center">
        <div className="homepage-reveal max-w-2xl">
          {section.eyebrow ? (
            <p className="inline-flex rounded-full border border-gold/45 bg-ink/35 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-gold backdrop-blur-sm">
              {section.eyebrow}
            </p>
          ) : null}
          <h1
            className="mt-5 text-5xl font-semibold leading-[0.94] tracking-[-0.055em] text-balance sm:text-6xl lg:text-7xl xl:text-8xl"
            id={`${section.id}-title`}
          >
            {section.title}
          </h1>
          {section.subtitle ? (
            <p className="mt-5 max-w-lg text-base leading-7 text-paper/85 sm:text-lg">
              {section.subtitle}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            {section.primaryCta ? (
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md bg-gold px-6 text-sm font-bold text-ink transition-colors hover:bg-paper motion-reduce:transition-none"
                href={section.primaryCta.href}
              >
                {section.primaryCta.label}
              </Link>
            ) : null}
            {section.secondaryCta ? (
              <Link
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-md border border-paper/35 px-6 text-sm font-bold transition-colors hover:border-paper hover:bg-paper hover:text-ink motion-reduce:transition-none"
                href={section.secondaryCta.href}
              >
                {section.secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
        <ArrowDownRight
          aria-hidden="true"
          className="absolute bottom-10 right-0 hidden size-9 text-gold lg:block"
        />
      </div>
    </section>
  );
}
