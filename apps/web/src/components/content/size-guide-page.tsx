import Image from "next/image";
import { storefrontMedia, type ContentPageDto } from "@thread/types";

import { BusinessContentPage } from "./business-content-page";

export function SizeGuidePage({ page }: { page: ContentPageDto }) {
  const image = storefrontMedia.sizeGuide;
  return (
    <>
      <BusinessContentPage page={page} />
      <section className="shell-container -mt-4 pb-16" aria-labelledby="size-chart-title">
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-paper shadow-subtle">
          <div className="border-b border-ink/10 p-5 sm:p-7">
            <h2 className="text-2xl font-semibold tracking-tight" id="size-chart-title">
              T-shirt measurements
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              The supplied chart covers sizes S to 2XL. The measurement unit and fit-specific
              applicability still require client confirmation before production launch.
            </p>
          </div>
          <div className="relative aspect-[2/1] w-full bg-ivory">
            <Image
              alt={image.alt}
              className="object-contain"
              fill
              sizes="(max-width: 767px) 100vw, 1200px"
              src={image.src}
            />
          </div>
        </div>
      </section>
    </>
  );
}
