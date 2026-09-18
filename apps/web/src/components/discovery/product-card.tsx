import Image from "next/image";
import Link from "next/link";
import type { ProductSummaryDto } from "@thread/types";
import { Badge, Price } from "@thread/ui";
import { Star } from "lucide-react";

import { WishlistToggle } from "./wishlist-toggle";

export function productHref(slug: string): string {
  return `/shop/${encodeURIComponent(slug)}`;
}

export function ProductCard({ product }: { product: ProductSummaryDto }) {
  const discount =
    product.minMrpPaise > 0
      ? Math.max(
          0,
          Math.round(
            ((product.minMrpPaise - product.minSalePricePaise) / product.minMrpPaise) * 100,
          ),
        )
      : 0;

  const STANDARD_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
  const isAccessory = product.audience === "accessories";
  const displaySizes =
    product.sizes && product.sizes.length > 0
      ? product.sizes
      : isAccessory
        ? ["One Size"]
        : STANDARD_SIZES;

  return (
    <article className="group relative min-w-0">
      <div className="absolute right-2 top-2 z-raised">
        <WishlistToggle productId={product.id} productTitle={product.title} />
      </div>
      <Link
        aria-label={`${product.title}, ${product.available ? "available" : "sold out"}`}
        className="focus-ring block rounded-lg"
        data-analytics-event="select_item"
        data-analytics-item-id={product.id}
        data-analytics-item-name={product.title}
        href={productHref(product.slug)}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-ivory">
          {product.primaryImage ? (
            <Image
              alt={product.primaryImage.alt}
              className="object-cover transition-transform duration-slow group-hover:scale-[1.02] motion-reduce:transition-none"
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1535px) 33vw, 25vw"
              src={product.primaryImage.secureUrl}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#f1ede4,#ddd4c4)] text-xs font-black tracking-[0.2em] text-ink/30">
              THREAD
            </div>
          )}
          {product.secondaryImage ? (
            <Image
              alt=""
              aria-hidden="true"
              className="pointer-events-none object-cover opacity-0 transition-opacity duration-normal group-hover:opacity-100 motion-reduce:transition-none"
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1535px) 33vw, 25vw"
              src={product.secondaryImage.secureUrl}
            />
          ) : null}
          {product.fit ? (
            <Badge className="absolute left-2 top-2 max-w-[calc(100%-4.5rem)] truncate bg-paper/95 text-[0.65rem] uppercase tracking-wide">
              {product.fit}
            </Badge>
          ) : null}
          {!product.available ? (
            <span className="absolute inset-x-0 bottom-0 bg-charcoal/92 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] text-paper">
              Sold out
            </span>
          ) : product.ratingCount > 0 ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-paper/95 px-2 py-1 text-xs font-semibold shadow-subtle">
              <Star aria-hidden="true" className="size-3 fill-gold text-gold" />
              {product.ratingAverage.toFixed(1)}
              <span className="text-muted">({product.ratingCount})</span>
              <span className="sr-only">ratings</span>
            </span>
          ) : null}
        </div>
      </Link>

      {/* Size Buttons Under the Picture with Size Tag on the Side */}
      <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 rounded bg-charcoal/5 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-muted border border-ink/10">
          SIZE
        </span>
        <div
          className="flex flex-wrap items-center gap-1"
          aria-label="Available sizes"
          role="group"
        >
          {displaySizes.map((sz) => (
            <Link
              key={sz}
              href={`${productHref(product.slug)}?size=${encodeURIComponent(sz)}`}
              className="inline-flex min-w-6 h-5.5 items-center justify-center rounded border border-ink/15 bg-paper px-1.5 text-[0.65rem] font-semibold text-charcoal shadow-xs transition-all duration-fast hover:border-ink hover:bg-ink hover:text-paper active:scale-95 focus-ring"
              title={`Select size ${sz}`}
            >
              {sz}
            </Link>
          ))}
        </div>
      </div>

      <Link href={productHref(product.slug)} className="focus-ring block pt-2" tabIndex={-1}>
        <h2 className="line-clamp-1 text-sm font-semibold sm:text-base">{product.title}</h2>
        <p className="mt-1 line-clamp-1 text-xs text-muted sm:text-sm">
          {product.fit ?? product.shortDescription}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <Price amount={product.minSalePricePaise} />
          {discount > 0 ? (
            <>
              <Price
                amount={product.minMrpPaise}
                className="text-xs font-normal text-muted line-through"
              />
              <span className="text-xs font-semibold text-success">{discount}% off</span>
            </>
          ) : null}
        </div>
        {discount > 0 ? (
          <span className="mt-2 inline-flex rounded-sm bg-gold/15 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide">
            Sale
          </span>
        ) : null}
        {product.colours.length ? (
          <div
            className="mt-3 flex items-center gap-1.5"
            aria-label="Available colours"
            role="list"
          >
            {product.colours.slice(0, 5).map((colour) => (
              <span
                key={colour.name}
                className="size-4 rounded-full border border-ink/20 bg-ivory shadow-[inset_0_0_0_1px_rgb(255_255_255/.7)]"
                role="listitem"
                style={colour.hex ? { backgroundColor: colour.hex } : undefined}
                title={colour.name}
              />
            ))}
            {product.colours.length > 5 ? (
              <span className="text-[0.65rem] text-muted">+{product.colours.length - 5}</span>
            ) : null}
          </div>
        ) : null}
      </Link>
    </article>
  );
}
