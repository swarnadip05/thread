import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@thread/ui";
import { Star } from "lucide-react";

import { ProductCard } from "@/components/discovery/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchasePanel } from "@/components/product/product-purchase-panel";
import { ProductReviews } from "@/components/product/product-reviews";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { loadProductDetail, loadProductSlugRedirect } from "@/services/catalogue";
import { loadContentPage } from "@/services/site-settings";
import { ProductViewAnalytics } from "@/analytics/product-view-analytics";
import { jsonLd, siteUrl } from "@/seo/site";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadProductDetail(slug);
  if (!data) return { title: "Product not found | THREAD" };
  return {
    title: data.product.seo?.title || `${data.product.title} | THREAD`,
    robots: { index: !data.product.seo?.noIndex },
    description: data.product.seo?.description || data.product.shortDescription,
    alternates: { canonical: `/shop/${data.product.slug}` },
    openGraph: {
      title: data.product.title,
      description: data.product.seo?.description || data.product.shortDescription,
      ...(data.product.primaryImage ? { images: [data.product.primaryImage.secureUrl] } : {}),
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [data, shipping, returns] = await Promise.all([
    loadProductDetail(slug),
    loadContentPage("shipping-delivery"),
    loadContentPage("returns-exchanges"),
  ]);
  if (!data) {
    const redirectSlug = await loadProductSlugRedirect(slug);
    if (redirectSlug) permanentRedirect(`/shop/${encodeURIComponent(redirectSlug)}`);
    notFound();
  }
  const { product } = data;
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    "@id": `${siteUrl}/shop/${product.slug}`,
    name: product.title,
    description: product.shortDescription,
    brand: { "@type": "Brand", name: product.brand },
    productGroupID: product.id,
    variesBy: ["https://schema.org/color", "https://schema.org/size"],
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
    hasVariant: product.variants.map((variant) => ({
      "@type": "Product",
      sku: variant.sku,
      name: `${product.title} — ${variant.colour}, ${variant.size}`,
      color: variant.colour,
      size: variant.size,
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: (variant.salePricePaise / 100).toFixed(2),
        availability:
          variant.availableStock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: `${siteUrl}/shop/${product.slug}`,
      },
    })),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: product.title,
        item: `${siteUrl}/shop/${product.slug}`,
      },
    ],
  };

  return (
    <section className="shell-container pb-40 pt-6 sm:pb-12" aria-labelledby="product-heading">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link className="focus-ring rounded-sm hover:text-ink" href="/">
          Home
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{product.title}</span>
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,.85fr)] xl:gap-16">
        <ProductGallery media={product.media} title={product.title} />
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
            {product.brand}
          </p>
          <h1
            className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
            id="product-heading"
          >
            {product.title}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {product.ratingCount > 0 ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-1 font-semibold">
                  {product.ratingAverage.toFixed(1)}
                  <Star aria-hidden="true" className="size-3 fill-gold text-gold" />
                </span>
                <a
                  className="focus-ring rounded-sm text-muted underline-offset-4 hover:underline"
                  href="#reviews-heading"
                >
                  {product.ratingCount} review{product.ratingCount === 1 ? "" : "s"}
                </a>
              </>
            ) : (
              <span className="text-muted">Not yet rated</span>
            )}
          </div>
          <div className="mt-6">
            <ProductPurchasePanel maxQuantity={data.purchaseConfig.maxQuantity} product={product} />
          </div>
        </section>
      </div>

      <section className="mt-16 grid gap-10 border-t border-ink/10 py-12 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="text-2xl font-semibold">Product details</h2>
          {/* Product rich text is sanitised on API write and never accepted directly from the browser. */}
          <div
            className="prose mt-5 max-w-none text-sm leading-7 text-charcoal"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />
          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Material</dt>
              <dd className="mt-1 text-sm text-muted">
                {product.material || "Awaiting product-specific confirmation."}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Fit</dt>
              <dd className="mt-1 text-sm text-muted">
                {product.fit || "Awaiting product-specific confirmation."}
              </dd>
            </div>
          </dl>
          <h3 className="mt-8 font-semibold">Care</h3>
          {product.care.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {product.care.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Product-specific care instructions are awaiting confirmation.
            </p>
          )}
        </div>
        <Accordion collapsible type="single">
          <AccordionItem value="shipping">
            <AccordionTrigger>Shipping & delivery</AccordionTrigger>
            <AccordionContent>
              <p>{shipping?.summary}</p>
              <Link
                className="mt-3 inline-block font-semibold text-ink underline"
                href="/shipping-delivery"
              >
                Read shipping policy
              </Link>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="returns">
            <AccordionTrigger>Returns & exchanges</AccordionTrigger>
            <AccordionContent>
              <p>{returns?.summary}</p>
              <Link
                className="mt-3 inline-block font-semibold text-ink underline"
                href="/returns-exchanges"
              >
                Read returns policy
              </Link>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <ProductReviews
        initialReviews={data.reviews}
        productId={product.id}
        productSlug={product.slug}
      />
      {data.related.length ? (
        <section className="border-t border-ink/10 py-12" aria-labelledby="related-heading">
          <h2 className="text-2xl font-semibold" id="related-heading">
            You may also like
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
            {data.related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
      <RecentlyViewed current={product} />
      <ProductViewAnalytics product={product} />
      <script
        dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
        type="application/ld+json"
      />
    </section>
  );
}
