"use client";

import type { ChangeEvent } from "react";
import type {
  HomepageCollectionOptionDto,
  HomepageImageDto,
  HomepageSectionDto,
} from "@thread/types";
import { Badge, Button, Input } from "@thread/ui";
import { ArrowDown, ArrowUp, GripVertical, ImagePlus } from "lucide-react";

function localDate(iso: string | undefined): string {
  return iso ? iso.slice(0, 16) : "";
}

function isoDate(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function HomepageSectionEditor({
  collections,
  isFirst,
  isLast,
  onImageUpload,
  onMove,
  onScheduleChange,
  onUpdate,
  section,
  uploading,
}: {
  collections: readonly HomepageCollectionOptionDto[];
  isFirst: boolean;
  isLast: boolean;
  onImageUpload(sectionId: string, slot: "desktopImage" | "mobileImage", file: File): void;
  onMove(sectionId: string, direction: -1 | 1): void;
  onScheduleChange(
    sectionId: string,
    field: "startsAt" | "endsAt",
    value: string | undefined,
  ): void;
  onUpdate(sectionId: string, patch: Partial<HomepageSectionDto>): void;
  section: HomepageSectionDto;
  uploading: string | null;
}) {
  const updateText =
    (field: "eyebrow" | "title" | "subtitle" | "body") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onUpdate(section.id, { [field]: event.target.value });
  const updateImageAlt =
    (slot: "desktopImage" | "mobileImage", image: HomepageImageDto) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onUpdate(section.id, { [slot]: { ...image, alt: event.target.value } });

  return (
    <article
      className="rounded-lg border border-ink/10 bg-paper p-5 text-ink shadow-subtle"
      data-section-id={section.id}
      draggable
    >
      <div className="flex items-start gap-3">
        <GripVertical aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{section.title}</h2>
            <Badge>{section.type.replaceAll("_", " ")}</Badge>
            {section.needsClientReview ? <Badge variant="error">Client review</Badge> : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Order {section.sortOrder} · {section.id}
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            checked={section.enabled}
            className="size-5 accent-gold"
            onChange={(event) => onUpdate(section.id, { enabled: event.target.checked })}
            type="checkbox"
          />
          Enabled
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Eyebrow
          <Input onChange={updateText("eyebrow")} value={section.eyebrow ?? ""} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Heading
          <Input onChange={updateText("title")} required value={section.title} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
          Subtitle
          <Input onChange={updateText("subtitle")} value={section.subtitle ?? ""} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
          Body copy
          <textarea
            className="min-h-24 rounded-md border border-ink/20 p-3 outline-none focus-visible:ring-3 focus-visible:ring-gold/40"
            onChange={updateText("body")}
            value={section.body ?? ""}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Campaign starts
          <Input
            onChange={(event) =>
              onScheduleChange(section.id, "startsAt", isoDate(event.target.value))
            }
            type="datetime-local"
            value={localDate(section.startsAt)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Campaign ends
          <Input
            onChange={(event) =>
              onScheduleChange(section.id, "endsAt", isoDate(event.target.value))
            }
            type="datetime-local"
            value={localDate(section.endsAt)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Primary CTA label
          <Input
            onChange={(event) =>
              onUpdate(section.id, {
                primaryCta: {
                  label: event.target.value,
                  href: section.primaryCta?.href ?? "/",
                },
              })
            }
            value={section.primaryCta?.label ?? ""}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Primary CTA internal path
          <Input
            onChange={(event) =>
              onUpdate(section.id, {
                primaryCta: {
                  label: section.primaryCta?.label ?? "Explore",
                  href: event.target.value,
                },
              })
            }
            pattern="/.*"
            placeholder="/shop/men"
            value={section.primaryCta?.href ?? ""}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Secondary CTA label
          <Input
            onChange={(event) =>
              onUpdate(section.id, {
                secondaryCta: {
                  label: event.target.value,
                  href: section.secondaryCta?.href ?? "/",
                },
              })
            }
            value={section.secondaryCta?.label ?? ""}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Secondary CTA internal path
          <Input
            onChange={(event) =>
              onUpdate(section.id, {
                secondaryCta: {
                  label: section.secondaryCta?.label ?? "Explore",
                  href: event.target.value,
                },
              })
            }
            pattern="/.*"
            placeholder="/shop/women"
            value={section.secondaryCta?.href ?? ""}
          />
        </label>
      </div>

      {["new_arrivals", "best_sellers", "collections"].includes(section.type) ? (
        <label className="mt-4 grid gap-1.5 text-sm font-medium">
          Product collections
          <select
            className="min-h-28 rounded-md border border-ink/20 bg-paper p-2"
            multiple
            onChange={(event) =>
              onUpdate(section.id, {
                collectionSlugs: [...event.target.selectedOptions].map((option) => option.value),
              })
            }
            value={[...section.collectionSlugs]}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.slug}>
                {collection.name}
                {collection.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted">
            Hold Ctrl/Command to select more than one collection.
          </span>
        </label>
      ) : null}

      {section.items.length ? (
        <div className="mt-5 rounded-md bg-ivory p-4">
          <p className="text-sm font-semibold">Section cards and features</p>
          <div className="mt-3 grid gap-3">
            {section.items.map((item) => (
              <div className="grid gap-3 md:grid-cols-2" key={item.id}>
                <label className="grid gap-1 text-xs font-medium">
                  {item.id} title
                  <Input
                    onChange={(event) =>
                      onUpdate(section.id, {
                        items: section.items.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, title: event.target.value }
                            : candidate,
                        ),
                      })
                    }
                    value={item.title}
                  />
                </label>
                <label className="grid gap-1 text-xs font-medium">
                  Link
                  <Input
                    onChange={(event) =>
                      onUpdate(section.id, {
                        items: section.items.map((candidate) =>
                          candidate.id === item.id
                            ? { ...candidate, href: event.target.value }
                            : candidate,
                        ),
                      })
                    }
                    placeholder={section.type === "social" ? "https://instagram.com/…" : "/shop/…"}
                    value={item.href ?? ""}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(["desktopImage", "mobileImage"] as const).map((slot) => {
          const image = section[slot];
          return (
            <div className="rounded-md border border-dashed border-ink/20 p-4" key={slot}>
              <p className="text-sm font-semibold">
                {slot === "desktopImage" ? "Desktop image" : "Mobile image"}
              </p>
              {image ? (
                <Input
                  aria-label={`${slot} alt text`}
                  className="mt-3"
                  onChange={updateImageAlt(slot, image)}
                  placeholder="Meaningful alt text"
                  value={image.alt}
                />
              ) : (
                <p className="mt-2 text-xs text-muted">No approved image selected.</p>
              )}
              <label className="focus-ring mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-ink/20 px-4 text-sm font-semibold">
                <ImagePlus aria-hidden="true" className="size-4" />
                {uploading === `${section.id}:${slot}` ? "Uploading…" : "Upload image"}
                <input
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onImageUpload(section.id, slot, file);
                    event.target.value = "";
                  }}
                  type="file"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2 border-t border-ink/10 pt-4">
        <Button
          aria-label={`Move ${section.title} up`}
          disabled={isFirst}
          onClick={() => onMove(section.id, -1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ArrowUp aria-hidden="true" className="size-4" />
          Move up
        </Button>
        <Button
          aria-label={`Move ${section.title} down`}
          disabled={isLast}
          onClick={() => onMove(section.id, 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
          Move down
        </Button>
      </div>
    </article>
  );
}
