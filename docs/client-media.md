# THREAD client-media integration

The supplied `pictures/` handoff remains the untouched source archive. Run:

```bash
pnpm assets:prepare
```

This reproducibly:

- groups each four-image sequence as one product gallery;
- writes normalised browser assets under
  `apps/web/public/assets/approved/client-products/`;
- publishes the supplied size chart under
  `apps/web/public/assets/approved/size-guides/`;
- generates typed product/media mappings in
  `packages/types/src/generated-client-assets.ts`;
- regenerates the storefront manifest and `docs/asset-audit.md`.

## Current mapping

- Men's oversized: 23 approved styles, four views each.
- Men's regular: 25 approved styles, four views each.
- Women's regular: 25 approved styles, four views each.
- Size guide: one approved source image, with its unit and fit applicability still
  awaiting client confirmation.
- Total browser-ready media: 292 product photos plus one size chart.

Two complete men's oversized galleries are quarantined:

- style 14: PlayStation-style controller symbols;
- style 20: Minion character artwork.

The quarantine uses both source paths and SHA-256 hashes, so renaming or copying one
of those eight files does not accidentally approve it. Add those styles only after
the relevant third-party licence is documented and the denylist is deliberately
reviewed.

## Where images appear

- Homepage: responsive hero, men/women entry cards, category cards and editorial
  panel.
- Mega menu: approved men's and women's promotional tiles.
- Catalogue: the development demo seed creates 73 clearly labelled product records
  with four-image galleries.
- Product detail: thumbnails, main gallery, swipe controls, lightbox and zoom.
- Size Guide: responsive optimised chart with a visible client-confirmation note.

`next/image` handles responsive source sets, lazy loading and format negotiation.
The hero uses Next.js art direction and prioritises its above-the-fold image.

## Commerce-data boundary

Image approval does not confirm product price, MRP, colour naming, sellable sizes,
stock, weight, material, HSN or tax. The local demo seed uses conspicuous
demonstration values and is disabled in production. Before live launch, the client
must create or import confirmed product/variant data and associate these approved
media records through the admin catalogue workflow.

Do not remove the `[DEMO]` labels or enable the demo seed in production.

## Media verification

After preparing assets:

```bash
test "$(find apps/web/public/assets/approved/client-products -type f | wc -l | tr -d ' ')" = "292"
test "$(find apps/web/public/assets/approved/size-guides -type f | wc -l | tr -d ' ')" = "1"
pnpm assets:audit
pnpm check
```

The audit should report 293 browser-ready approved public assets and eight excluded
source images.
