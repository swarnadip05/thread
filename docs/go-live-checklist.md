# THREAD go-live checklist

**Release status: not production-ready until every applicable item below is evidenced, approved, and signed off by the named owner.** A passing build, deployment, or smoke test alone is not production approval.

Release commit: `________________`  
Staging evidence link: `________________`  
Target date/change window: `________________`  
Release owner: `________________`  
Rollback owner: `________________`

## Client and legal approval

- [ ] Client approves the final THREAD branding, logo use, copy, campaigns, and responsive presentation.
- [ ] Client verifies SNAP CART legal name, address, GSTIN, phone, WhatsApp number, and email in SiteSettings, footer, contact page, invoice, and transactional messages.
- [ ] Accountant verifies every used HSN code, GST/tax rule, inclusive/exclusive tax display, invoice calculation, place-of-supply handling, and rounding. No unconfirmed default is live.
- [ ] Client verifies shipping regions, charges, service levels, 3–7 business-day domestic wording, 7–21 business-day international wording, and customs responsibility.
- [ ] Client verifies the one-hour change/cancellation wording and seven-day unworn/unwashed return/exchange policy, including exclusions and operational process.
- [ ] Legal/client approver signs off Privacy Policy, Terms & Conditions, cookie/analytics behavior, data retention, and customer-consent wording.
- [ ] Rights owner verifies licence/ownership for every product image, logo, font, campaign asset, and other published media. No competitor/copyright-reference asset is approved by implication.
- [ ] Client approves WhatsApp consent collection, prefilled message text, template/provider use where applicable, opt-out handling, and data ownership.
- [ ] Named owners and escalation paths exist for customer support, fulfilment, catalogue, payment reconciliation, incidents, privacy requests, and after-hours response.

## Product, order, and customer experience

- [ ] Production catalogue, variants, SKUs, prices in paise, stock, images, size guide, care instructions, categories, and menu order were reviewed against the client source of truth.
- [ ] Desktop and mobile checkout were tested on representative browsers/devices, including a 360/390 px mobile flow, address validation, keyboard use, screen-reader labels, errors, and retry behavior.
- [ ] Customer registration/login, verification, reset, refresh rotation, logout, account protection, admin RBAC, and audit records were verified.
- [ ] Inventory reservation, expiry, concurrent last-unit checkout, payment failure, webhook retry/out-of-order delivery, and duplicate-request idempotency were verified.
- [ ] Cancellation and refund were tested end-to-end, including inventory, order status, payment provider, customer message, and reconciliation.
- [ ] Order confirmation and status emails were reviewed on desktop/mobile and major mailbox providers; sender identity, reply/support path, links, totals, and no-sensitive-data policy were verified.
- [ ] Invoice was reviewed by the client and accountant for identity, numbering, tax/HSN fields, totals, rendering, download permissions, and record retention.

## Payments

- [ ] Razorpay merchant/KYC activation and settlement bank ownership are complete.
- [ ] Approved payment methods and capture configuration are recorded.
- [ ] Test Mode payments, failures, webhook validation/replay, and refund passed.
- [ ] Live keys and a unique live webhook secret are stored only in Render; the secret is absent from Vercel, source, browser bundles, logs, and tickets.
- [ ] The exact live webhook URL and selected events are verified in the Razorpay dashboard.
- [ ] One controlled live payment was captured, fulfilled only after authoritative verification, reconciled to settlement records, then refunded and reconciled.

## Infrastructure, security, and recovery

- [ ] CI formatting, lint, strict type-check, unit/integration tests, security checks, and production builds pass for the release commit.
- [ ] API and worker containers were scanned/reviewed, run as non-root, and were built from the pinned lockfile/runtime.
- [ ] `main` protection, required checks, approvals, preview deployment, production manual approval, secret scanning, and least-privilege repository access are enabled.
- [ ] Staging and production credentials/resources are isolated; all credentials were delivered through encrypted provider stores and rotation ownership is recorded.
- [ ] Atlas user privileges and network allowlist/private access are least-privilege; production tier/capacity decision and index review are recorded.
- [ ] Atlas continuous backup/PITR, retention, backup alerts, and a successful timed restore test into an isolated environment are evidenced.
- [ ] Managed Redis uses TLS/auth and an allowlist/private path; memory/eviction, persistence, queue recovery, dead-letter handling, and credential rotation were tested.
- [ ] Cloudinary signed uploads, restrictions, transformations, retention, deletion, source-media backup, and restore/export procedure were verified.
- [ ] CORS, origin validation, trusted proxy hop count, secure cookies, CSRF, rate limits, security headers, and log redaction were tested on final hostnames.
- [ ] HTTPS certificates/renewal, forced redirects, external API health, and authenticated secure `wss` connectivity pass.
- [ ] SPF, DKIM, DMARC alignment, bounce handling, and preservation of existing MX records are verified.

## Operations and launch

- [ ] Monitoring dashboards and alerts cover Vercel, API health/latency/errors, Socket.IO connectivity, worker uptime, BullMQ age/depth/failures, dead letters, Atlas, Redis, email delivery, Cloudinary, and Razorpay webhooks/reconciliation.
- [ ] Each critical alert reaches a named owner and a test alert was acknowledged within the agreed response target.
- [ ] Runbooks cover deploy, rollback, provider outage, payment ambiguity, stuck reservations/jobs, refund, credential rotation, backup restore, customer/privacy request, and incident communication.
- [ ] Support team has approved scripts, permissions, escalation paths, order lookup workflow, and Monday–Friday 24-hour response-target ownership.
- [ ] Final DNS records, previous values, TTLs, registrar access, provider owners, and rollback plan are recorded.
- [ ] Release smoke test and a 24-hour heightened-monitoring window are assigned.

## Sign-off

Client/SNAP CART owner — name/signature/date: `________________________________`  
Engineering release owner — name/signature/date: `________________________________`  
Finance/accounting owner — name/signature/date: `________________________________`  
Legal/privacy approver — name/signature/date: `________________________________`  
Operations/support owner — name/signature/date: `________________________________`

Only after all applicable checks and signatures are complete may the release owner change the recorded status from **not production-ready** to an approved production release.
