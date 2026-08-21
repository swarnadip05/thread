import Link from "next/link";
import type { HomepageSectionDto } from "@thread/types";

export function SectionHeading({
  align = "left",
  section,
}: {
  align?: "left" | "center";
  section: HomepageSectionDto;
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-3xl text-center"
          : "flex items-end justify-between gap-6"
      }
    >
      <div>
        {section.eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink/70">
            {section.eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
          {section.title}
        </h2>
        {section.subtitle ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {section.subtitle}
          </p>
        ) : null}
      </div>
      {align === "left" && section.primaryCta ? (
        <Link
          className="focus-ring hidden shrink-0 rounded-sm border-b border-ink pb-1 text-sm font-semibold md:block"
          href={section.primaryCta.href}
        >
          {section.primaryCta.label}
        </Link>
      ) : null}
    </div>
  );
}
