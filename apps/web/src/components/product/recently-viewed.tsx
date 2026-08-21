"use client";

import Image from "next/image";
import Link from "next/link";
import type { ProductDetailDto } from "@thread/types";
import { Price } from "@thread/ui";
import { useEffect, useState } from "react";

interface RecentProduct {
  id: string;
  slug: string;
  title: string;
  price: number;
  image?: { src: string; alt: string };
}
const KEY = "thread:recent-products:v1";

export function RecentlyViewed({ current }: { current: ProductDetailDto }) {
  const [items, setItems] = useState<RecentProduct[]>([]);
  useEffect(() => {
    let stored: RecentProduct[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentProduct[];
    } catch {
      stored = [];
    }
    const prior = stored.filter((item) => item.id !== current.id).slice(0, 5);
    const record: RecentProduct = {
      id: current.id,
      slug: current.slug,
      title: current.title,
      price: current.minSalePricePaise,
      ...(current.primaryImage
        ? { image: { src: current.primaryImage.secureUrl, alt: current.primaryImage.alt } }
        : {}),
    };
    localStorage.setItem(KEY, JSON.stringify([record, ...prior]));
    queueMicrotask(() => setItems(prior));
  }, [current]);
  if (!items.length) return null;
  return (
    <section className="py-12" aria-labelledby="recent-heading">
      <h2 className="text-2xl font-semibold" id="recent-heading">
        Recently viewed
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <Link className="focus-ring rounded-lg" href={`/shop/${item.slug}`} key={item.id}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-ivory">
              {item.image ? (
                <Image
                  alt={item.image.alt}
                  className="object-cover"
                  fill
                  sizes="(max-width: 767px) 50vw, 20vw"
                  src={item.image.src}
                />
              ) : null}
            </div>
            <h3 className="mt-2 line-clamp-1 text-sm font-semibold">{item.title}</h3>
            <Price amount={item.price} className="text-sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
