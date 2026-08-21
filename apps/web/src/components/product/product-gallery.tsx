"use client";

import Image from "next/image";
import { Dialog, IconButton } from "@thread/ui";
import type { ProductMediaDto } from "@thread/types";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useRef, useState } from "react";

export function ProductGallery({
  media,
  title,
}: {
  media: readonly ProductMediaDto[];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef(0);
  const selected = media[index];
  const move = (delta: number) =>
    setIndex((current) => (current + delta + media.length) % media.length);

  if (!selected)
    return (
      <div className="grid aspect-[4/5] place-items-center rounded-lg bg-[linear-gradient(145deg,#f1ede4,#ddd4c4)] text-lg font-black tracking-[0.2em] text-ink/30">
        THREAD
      </div>
    );

  const image = (sizes: string, priority = false) => (
    <Image
      alt={selected.alt || title}
      className="object-contain"
      fill
      priority={priority}
      sizes={sizes}
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
      <div
        className="group relative order-1 aspect-[4/5] overflow-hidden rounded-lg bg-ivory md:order-2"
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
