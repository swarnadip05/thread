# Discoverability, accessibility and performance checklist

## Release checks

- [ ] Verify every published product, category and collection has a unique, stable slug and canonical URL.
- [ ] Confirm JSON-LD price and availability against the rendered product variant before publishing.
- [ ] Keep archived or unpublished products at `404`; keep sold-out products public so their availability can be indexed accurately.
- [ ] Preserve previous product slugs and configure a permanent redirect before changing an indexed slug. Catalogue updates now retain the old slug automatically.
- [ ] Review `robots.txt` and `sitemap.xml` after adding a new public route.
- [ ] Provide meaningful alt text for product, campaign and category media. Decorative imagery must use an empty alt value.
- [ ] Test the utility bar, mega menu, drawers, dialogs, search suggestions, checkout and forms using keyboard only.
- [ ] Check focus restoration after every dialog, sheet and mobile drawer closes.
- [ ] Verify form errors use `aria-describedby` and that required inputs have visible labels.
- [ ] Test at 360, 390, 768, 1024, 1440 and 1920 CSS pixels. Interactive controls should be at least 44 × 44px where practical.
- [ ] Test with reduced motion enabled and at 200% browser zoom.
- [ ] Audit contrast for new foreground/background combinations; the THREAD gold accent must not be used as small text on ivory or paper.

## Analytics privacy

- [ ] Do not configure an analytics provider until the client has approved its privacy notice.
- [ ] Confirm the consent banner gates external loading and that refusal leaves the storefront fully functional.
- [ ] Inspect provider debug traffic for email, phone, address, password, session/token, payment signature and full payment payloads.
- [ ] Admin analytics screens must name their source (server-confirmed order/payment records) and selected date range.

## Performance budget and measurement

The target is a Lighthouse mobile Performance score of **at least 85** on a representative published category and product page, with Accessibility at least **95**. These are release goals, not claimed measurements.

Run an actual production-like measurement after seeding representative approved media:

```bash
pnpm --filter @thread/web build
pnpm --filter @thread/web start
npx lighthouse http://localhost:3000/men --only-categories=performance,accessibility --view
npx lighthouse http://localhost:3000/shop/<published-slug> --only-categories=performance,accessibility --view
```

Record the date, route, device preset, seed data and score in the release ticket. This repository does not contain a fabricated Lighthouse score because a reliable measurement needs a running API, published products and approved production-like imagery.

## Cache and query safeguards

- Anonymous product list, facet, product-detail and related-product responses use a short public cache and are invalidated after catalogue mutations.
- Keep search suggestions and authenticated/private responses out of shared caches.
- Maintain product listing indexes when adding a new filter; inspect query plans against representative data.
- Use pagination for all catalogue exports and public listings; do not add client-only infinite scrolling.
- Keep media behind `next/image` with an accurate `sizes` value. Use `priority` only for the initial above-the-fold image.
