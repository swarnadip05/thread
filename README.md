# THREAD commerce

Production-oriented pnpm/Turborepo workspace for the THREAD storefront and API. See [local development](docs/local-development.md) for setup and exact startup commands.

Deployment configuration is documented in [deployment and operations](docs/deployment.md), with the environment-by-environment values in the [environment matrix](docs/environment-matrix.md). A release must not be described as production-ready until every applicable item in the [go-live checklist](docs/go-live-checklist.md) is approved and signed off.

Product creation, inventory adjustment, image-upload requirements and the one-time
administrator bootstrap are covered in
[admin product operations](docs/admin-product-operations.md).

## Storefront assets

The approved client-media workflow is documented in
[docs/client-media.md](docs/client-media.md). The original handoff stays in
`pictures/`; normalised browser copies, typed mappings and the audit are rebuilt with:

```bash
pnpm assets:prepare
```

New logo, hero, category, product and campaign sources should first be placed in the
client handoff folder with ownership/licence confirmation, intended placement, alt
text and crop guidance. Do not add competitor material, licensed characters without
documented permission, reference screenshots, private documents or embedded
secrets. Run `pnpm assets:audit` after any manual public-asset change.
