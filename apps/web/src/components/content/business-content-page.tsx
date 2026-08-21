import type { ContentPageDto } from "@thread/types";

export function BusinessContentPage({ page }: { page: ContentPageDto }) {
  return (
    <article>
      <header className="bg-ivory">
        <div className="shell-container py-14 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {page.eyebrow ?? "THREAD information"}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">{page.summary}</p>
        </div>
      </header>
      <div className="shell-container grid gap-6 py-12 sm:py-16">
        {page.sections.map((section) => (
          <section
            className="max-w-4xl border-t border-ink/12 pt-7"
            id={section.id}
            key={section.id}
          >
            {section.heading ? (
              <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
            ) : null}
            <div className="mt-4 grid gap-4 text-base leading-7 text-muted">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {section.items.length ? (
              <ul className="mt-4 grid list-disc gap-2 pl-5 text-muted">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
