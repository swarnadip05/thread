# THREAD final repository audit

Audit date: 28 July 2026  
Scope: the complete local `thread-commerce` workspace  
Release verdict: **not approved for production launch**

This is a source, configuration, and test audit. It does not replace client, legal,
accounting, payment-provider, infrastructure, or operational sign-off. The release
status in [go-live-checklist.md](go-live-checklist.md) remains authoritative.

## Executive summary

The repository has sound primary boundaries: the browser talks to a versioned
Express API, MongoDB access stays in API repositories, monetary values are integer
paise, privileged API routes use role middleware, customer-owned records are queried
with the authenticated user ID, and payment/inventory mutations use server-side
recalculation and transactions. TypeScript is strict across the workspace, provider
secrets are server-only, and Pino has explicit sensitive-field redaction.

The audit made only narrow, evidence-backed corrections:

- neutralised spreadsheet formulas in catalogue CSV exports and added a regression
  test;
- corrected the sitemap's two non-existent business-content URLs;
- blocked exact and nested private route prefixes in `robots.txt`;
- moved root metadata and Organization/WebSite JSON-LD business identity to the
  central settings fallback instead of duplicating client facts;
- removed an undocumented analytics environment gate so conversion renders only
  when the API actually supplies it;
- documented and wired the public admin environment label;
- corrected a cache comment that referred to a Redis cache adapter that does not
  exist.

No broad rewrite was attempted. The technical launch blockers below need deliberate
design, provider testing, or operational evidence before launch.

## Launch blockers

1. **There is no reviewable Git baseline.** The repository is on an unborn `master`
   branch and every top-level path is untracked. A reviewer cannot distinguish prior
   working code from audit changes, and there is no commit SHA for deployment or
   rollback. Establish an intentional initial commit through review before any
   release.
2. **Refund initiation does not own an idempotency lease before the provider call.**
   `PaymentService.refundOrder` checks MongoDB, calls Razorpay, and only then inserts
   the uniquely indexed refund record. Two concurrent admin requests can both reach
   the external refund call before either record exists. Introduce a durable
   refund-operation/lease state and prove concurrent retry behaviour against
   Razorpay Test Mode before enabling live refunds.
3. **A process crash can strand a webhook in `processing`.**
   `registerWebhook` reacquires only records marked `failed`; a crash after insertion
   but before completion causes later deliveries with the same event/hash to be
   treated as duplicates forever. Add a bounded processing lease/recovery path and
   test replay, concurrency, and `refund.processed` recovery before live payments.
4. **Production index application is an operator-only step with no checked
   migration command.** Production intentionally sets Mongoose `autoIndex: false`.
   The declared unique, ownership, TTL, state, and query indexes must be compared,
   approved, applied, and verified in staging and Atlas before traffic.
5. **The full browser/database path is not currently evidenced on this machine.**
   The Docker daemon is unavailable, so the MongoDB-replica-set/Redis-backed
   Playwright suite and release-container builds cannot run here. They must pass on
   the reviewed commit before launch.
6. **Multi-instance cache invalidation is process-local.** Navigation, public
   settings, homepage/catalogue cache state is invalidated only in the API process
   that handles a write. Run one API instance with the documented short TTL as an
   explicit temporary constraint, or implement shared Redis cache invalidation
   before horizontal scaling.
7. **TOTP must stay disabled.** The feature flag can require a TOTP code at login,
   but the repository has no enrolment or challenge-completion endpoint. Enabling
   `TOTP_ENABLED` would lock affected users out. Implement and test the full flow
   before enabling it.
8. **Business and provider approvals are outstanding.** The canonical domain,
   product rights, final policies, size guide, taxes/HSN/GST display, invoice,
   production catalogue, shipping rules, SMTP identity, Atlas/Redis/Cloudinary
   controls, Razorpay KYC/live payment/refund, backup restore, monitoring, and
   support ownership all require evidence and signatures in the go-live checklist.

## Improvements after blockers

- Split the 1,172-line checkout repository, 907-line catalogue repository,
  859-line validation entry point, 653-line operations repository, and the
  approximately 500-line payment/checkout/admin UI modules along domain seams.
  They work, but their size raises review and regression cost.
- Consolidate the three small CSV cell encoders into one tested API utility so all
  exports share whitespace/formula handling.
- Add a durable provider idempotency strategy for email side effects. BullMQ and
  `JobExecution` prevent normal duplicates, but a worker crash after SMTP acceptance
  and before the completion marker can still resend.
- Add an automated CI job for the local replica-set/Redis Playwright suite; the
  current CI workflow runs unit/API tests and builds, while browser tests are manual
  or preview-triggered.
- Add dedicated automated visual checks at 360, 768, and 1920 pixels. Existing
  checks cover 390-pixel mobile and 1440-pixel desktop layouts.
- Add route-level error/loading boundaries for the main storefront data routes and
  canonical alternates for editable content pages.
- Consider a dead-code/dependency analysis tool in CI. Strict TypeScript and ESLint
  found no unused symbols in this audit, but they do not prove that every exported
  module is reachable.

## Detailed audit

| Area                            | Result                                                | Evidence and residual risk                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Architecture boundaries      | Pass with deployment caveats                          | `apps/web` uses HTTP/Socket clients and has no Mongoose dependency. API routers/controllers call services; services use repository/provider interfaces. API and worker are separate entry points. Process-local cache invalidation remains a scaling blocker.                                                                                                                                                                               |
| 2. Type safety                  | Pass                                                  | Shared strict config enables `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `useUnknownInCatchVariables`, and related checks. No production `any` was found; test matches use Vitest's `expect.any`. Runtime inputs are parsed with Zod or narrow provider guards.                                                                                                                                                     |
| 3. Duplicate code               | Improvement                                           | Three CSV cell helpers and repeated router parameter/context helpers exist. Their scope is small; no risky consolidation was justified during this audit.                                                                                                                                                                                                                                                                                   |
| 4. Dead code                    | Pass with limitation                                  | No `TODO`, `FIXME`, or unexplained production `console` path was found. The unused `NEXT_PUBLIC_ANALYTICS_CONFIGURED` gate was removed. No reachability analyser is configured.                                                                                                                                                                                                                                                             |
| 5. Oversized modules            | Improvement                                           | The largest hand-written modules are the checkout/catalogue/operations repositories and shared type/validation entry points. Generated asset manifest size is expected and should not be hand-edited.                                                                                                                                                                                                                                       |
| 6. Error handling               | Pass                                                  | Express has a central safe error envelope and request ID, provider errors are sanitised, body-size errors map to 413, and unknown 500 details are not returned. Repository boundaries generally reject invalid ObjectIds before queries. Continue adding domain-specific error tests when splitting large modules.                                                                                                                          |
| 7. Authentication/authorization | Pass, TOTP blocked                                    | Argon2, short access tokens, rotating HttpOnly refresh cookies, family reuse revocation, logout/all, verification/reset, generic enumeration-safe responses, origin/CSRF checks, throttling, password backoff, RBAC, and audit logging are present. Tokens are not stored in local storage. TOTP is incomplete and must remain disabled.                                                                                                    |
| 8. Object-level permissions     | Pass                                                  | Customer checkout sessions/payments/orders, notifications, invoices, returns, and reviews include the authenticated user in repository queries. Admin access is enforced again by API roles; client-side admin protection is UX only.                                                                                                                                                                                                       |
| 9. Price/inventory integrity    | Pass pending live concurrency evidence                | Pricing is recalculated server-side in integer paise; coupon/shipping/tax data is not trusted from the browser. Variant availability uses `stockOnHand - stockReserved`; reservations and order conversion use MongoDB transactions and atomic predicates. Live last-unit/expiry/failure tests remain a release gate.                                                                                                                       |
| 10. Payment/webhook idempotency | Blocked                                               | Checkout/payment creation has hashed idempotency keys, unique provider/internal IDs, raw-body signature validation, event/hash uniqueness, and reconciliation. Refund initiation and stranded `processing` webhooks have the blockers described above.                                                                                                                                                                                      |
| 11. Queue idempotency           | Pass with provider caveat                             | Stable hashed BullMQ IDs, unique `JobExecution.key`, stale-lock recovery, retries/dead letters, notification dedupe, invoice existence checks, and idempotent reservation release are present. SMTP is inherently at-least-once without provider idempotency.                                                                                                                                                                               |
| 12. Database indexes            | Blocked operationally                                 | Models declare unique nullable user identifiers, slugs, SKUs, variant matrices, idempotency/provider IDs, webhook event/hash, refund/order, reservation/state/query, and other indexes. Production disables automatic creation; there is no release-checked index application command.                                                                                                                                                      |
| 13. Cache invalidation          | Blocked for horizontal scale                          | Writes clear current-process settings/navigation/catalogue caches and public reads have bounded TTLs. No distributed invalidation exists across API replicas or downstream Next/CDN caches.                                                                                                                                                                                                                                                 |
| 14. Accessibility               | Pass pending final device test                        | Shared primitives use labelled controls, focus-visible styles, keyboard/Escape behaviour, Radix dialogs/sheets, reduced motion, and appropriate touch targets. Playwright includes axe checks for storefront and mobile flows. Final screen-reader/keyboard/device evidence is still required.                                                                                                                                              |
| 15. Mobile responsiveness       | Pass with coverage improvement                        | Mobile drawers/bottom sheets/navigation and responsive grids are implemented; automated visual coverage exists at 390 and 1440 pixels. Add the viewport coverage listed above and complete real-device checkout verification.                                                                                                                                                                                                               |
| 16. SEO                         | Pass after fixes                                      | App Router metadata, canonical commerce routes, product/breadcrumb JSON-LD, sitemap, robots, Open Graph, and no-index rules for account/auth/checkout/search are present. The sitemap and private-prefix defects were fixed. The production canonical domain remains client-controlled configuration.                                                                                                                                       |
| 17. Image optimisation          | Pass                                                  | Storefront media uses `next/image`; the art-directed hero uses `getImageProps` to produce optimised source sets. Approved assets are separated by the generated manifest and competitor/reference assets are excluded. Cloudinary transformation/cost/licensing evidence remains a launch gate.                                                                                                                                             |
| 18. Logging/redaction           | Pass                                                  | Pino redacts authorization, cookies, CSRF/idempotency/Razorpay headers, passwords, tokens, signatures, address/phone/email bodies, provider payloads, and set-cookie. Unknown failures log request IDs; production does not enable local OTP/email token output.                                                                                                                                                                            |
| 19. Secret exposure             | Pass for source                                       | No committed `.env`, private key, obvious provider secret assignment, or browser `NEXT_PUBLIC_*` secret was found. Env examples contain names only, gitleaks and dependency audit workflows exist, and server secrets stay in API config. Provider stores and repository push protection still require operational verification.                                                                                                            |
| 20. Tests/documentation         | Pass locally where runnable; release evidence blocked | Unit/API coverage includes auth rotation/revocation/RBAC/reset/CSRF/rate limits, catalogue models/filters, pricing, checkout, payment webhooks, content, homepage, operations, reviews, realtime, health, and seeds. Playwright covers key storefront/admin/checkout/a11y/visual paths. Deployment, security, provider, local-development, and go-live documentation is substantial. Docker-dependent tests were unavailable in this audit. |

## Verification record

The repository must use Node `24.18.0` from `.nvmrc`; the ambient Node 20 shell
cannot run pnpm 11 because it lacks `node:sqlite`.

| Command                                                            | Result                                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                   | Passed: all 7 workspace projects already match the lockfile                                                       |
| `pnpm --filter @thread/api exec vitest run test/catalogue.test.ts` | Passed: 1 file, 10 tests                                                                                          |
| `pnpm format`                                                      | Passed                                                                                                            |
| `pnpm check`                                                       | Passed: format check, lint, strict type-check, 75 API tests, 6 web tests, API build, and Next.js production build |
| `pnpm audit --audit-level high`                                    | Passed: no known vulnerabilities found                                                                            |
| `pnpm test:e2e`                                                    | Failed before Playwright: Docker daemon socket unavailable, so MongoDB/Redis could not start                      |
| API/worker Docker release builds                                   | Blocked: Docker daemon unavailable                                                                                |

## Review and commit

Because the branch has no `HEAD` and all files are untracked, ordinary `git diff`
shows nothing. The following first marks untracked files as intent-to-add so their
contents become reviewable without staging them for commit:

```bash
nvm use
git status --short
git add --intent-to-add .
git diff --check
git diff --stat
git diff
```

Review the audit-specific paths directly:

```bash
git diff -- \
  apps/api/src/catalogue/catalogue.service.ts \
  apps/api/src/catalogue/public-catalogue-cache.ts \
  apps/api/test/catalogue.test.ts \
  apps/web/.env.example \
  apps/web/src/app/layout.tsx \
  apps/web/src/app/robots.ts \
  apps/web/src/app/sitemap.ts \
  apps/web/src/components/admin/admin-dashboard.tsx \
  docs/environment-matrix.md \
  docs/final-audit.md \
  turbo.json
```

After reviewing the entire initial repository, stage and inspect the exact initial
commit:

```bash
git add .
git diff --cached --check
git diff --cached --stat
git diff --cached --name-status
git status --short
git commit -m "chore: establish audited THREAD commerce baseline"
```

Do not run the final `git commit` until the full initial tree, generated assets,
licensing exclusions, blocked checks, and intended branch name have been reviewed.
