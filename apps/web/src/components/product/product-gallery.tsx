"use client";

import Image from "next/image";
import { Dialog, IconButton } from "@thread/ui";
import type { ProductMediaDto } from "@thread/types";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STANDARD_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export function ProductGallery({
  media,
  title,
  sizes,
  initialSize,
}: {
  media: readonly ProductMediaDto[];
  title: string;
  sizes?: readonly string[] | undefined;
  initialSize?: string | undefined;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [selectedSize, setSelectedSize] = useState(initialSize ?? "");
  const touchStart = useRef(0);
  const selected = media[index];
  const move = (delta: number) =>
    setIndex((current) => (current + delta + media.length) % media.length);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setSelectedSize(detail);
    };
    window.addEventListener("thread:size-selected", handleSync);
    return () => window.removeEventListener("thread:size-selected", handleSync);
  }, []);

  const handleSizeClick = (sz: string) => {
    setSelectedSize(sz);
    window.dispatchEvent(new CustomEvent("thread:size-selected", { detail: sz }));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("size", sz);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore if URL replacement fails in non-browser context
    }
  };

  const displaySizes = sizes && sizes.length > 0 ? Array.from(new Set(sizes)) : STANDARD_SIZES;

  if (!selected)
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-lg bg-[linear-gradient(145deg,#f1ede4,#ddd4c4)] text-lg font-black tracking-[0.2em] text-ink/30">
        THREAD
      </div>
    );

  const image = (sizesStr: string, priority = false) => (
    <Image
      alt={selected.alt || title}
      className="object-contain"
      fill
      priority={priority}
      sizes={sizesStr}
      src={selected.secureUrl}
    />
  );

  return (
    <div className="grid gap-3 md:grid-cols-[5rem_1fr]">
      <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:flex-col">
        {media.map((item, itemIndex) => (
          <button
            aria-label={`View image ${itemIndex + 1} of ${media.length}`}
            aria-pressed={itemIndex === index}
            className="focus-ring relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-md border aria-pressed:border-ink"
            key={item.publicId}
            onClick={() => setIndex(itemIndex)}
            type="button"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="object-cover"
              fill
              sizes="64px"
              src={item.secureUrl}
            />
          </button>
        ))}
      </div>
      <div className="order-1 flex flex-col gap-3 md:order-2">
        <div
          className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-ivory"
          onTouchEnd={(event) => {
            const distance = event.changedTouches[0]!.clientX - touchStart.current;
            if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
          }}
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]!.clientX;
          }}
        >
          {image("(max-width: 767px) 100vw, 45vw", true)}
          <IconButton
            aria-label="Open image gallery"
            className="absolute right-3 top-3 bg-paper/90"
            onClick={() => setLightbox(true)}
          >
            <Expand aria-hidden="true" className="size-5" />
          </IconButton>
          {media.length > 1 ? (
            <>
              <IconButton
                aria-label="Previous image"
                className="absolute left-3 top-1/2 bg-paper/90"
                onClick={() => move(-1)}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </IconButton>
              <IconButton
                aria-label="Next image"
                className="absolute right-3 top-1/2 bg-paper/90"
                onClick={() => move(1)}
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </IconButton>
            </>
          ) : null}
        </div>

        {/* Size Selection Strip Under the Picture */}
        <div className="flex items-center gap-2.5 rounded-lg border border-ink/10 bg-ivory/50 px-3 py-2 shadow-xs">
          <span className="shrink-0 rounded bg-charcoal/10 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-charcoal border border-ink/15">
            SIZE
          </span>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Available garment sizes"
          >
            {displaySizes.map((sz) => (
              <button
                key={sz}
                type="button"
                aria-pressed={selectedSize.toUpperCase() === sz.toUpperCase()}
                onClick={() => handleSizeClick(sz)}
                className={`inline-flex min-w-8 h-7.5 items-center justify-center rounded-md border text-xs font-semibold transition-all duration-fast ${
                  selectedSize.toUpperCase() === sz.toUpperCase()
                    ? "border-ink bg-ink text-paper shadow-sm"
                    : "border-ink/20 bg-paper text-charcoal hover:border-ink hover:bg-ink/5 active:scale-95"
                }`}
                title={`Select size ${sz}`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Dialog
        open={lightbox}
        onOpenChange={(open) => {
          setLightbox(open);
          if (!open) setZoomed(false);
        }}
        title={`${title} image ${index + 1}`}
      >
        <button
          aria-label={zoomed ? "Zoom out product image" : "Zoom in product image"}
          aria-pressed={zoomed}
          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-ivory [touch-action:pan-y] aria-pressed:cursor-zoom-out"
          onClick={() => setZoomed((value) => !value)}
          type="button"
        >
          <div
            className={`absolute inset-0 transition-transform duration-normal ${zoomed ? "scale-150" : ""}`}
          >
            {image("min(90vw, 32rem)")}
          </div>
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Tap or click to zoom. Use thumbnails to change view.
        </p>
      </Dialog>
    </div>
  );
}
