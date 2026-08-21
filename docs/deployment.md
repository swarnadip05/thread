# Deployment and operations

This repository contains deployable configuration, but that does not make the system production-ready. Production readiness requires the signed [go-live checklist](go-live-checklist.md).

## Process topology

- Vercel runs `apps/web` as the Next.js web application.
- Render runs `apps/api/Dockerfile` as the public Express and Socket.IO API.
- Render runs `apps/api/Dockerfile.worker` as the private BullMQ consumer.
- The API starts the BullMQ producer only. The worker consumes reservation-expiry, email, invoice, and stock jobs. Worker-originated Socket.IO events publish through the managed Redis adapter.
- MongoDB Atlas and managed Redis must be separate between staging and production.

The Express API trusts exactly `TRUST_PROXY_HOPS` proxy hops. Use `0` outside a known proxy and `1` for the documented Render edge-to-service path; re-evaluate this value if another CDN or load balancer is added. Never set Express trust proxy to an unrestricted boolean.

Set both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to the API's HTTPS origin. Socket.IO negotiates an encrypted `wss` transport from that HTTPS origin and can fall back to HTTPS long polling. The browser rejects an insecure socket origin when the storefront itself is HTTPS.

## Reproducible local release checks

Use the repository-pinned Node and pnpm versions:

```bash
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm check
docker build -f apps/api/Dockerfile -t thread-api:release-candidate .
docker build -f apps/api/Dockerfile.worker -t thread-worker:release-candidate .
```

Do not push those images or deploy from an unreviewed working tree. The containers use multi-stage builds, contain production dependencies plus compiled output, execute through `tini`, and run as the unprivileged `node` user.

## Provisioning order

1. Create isolated staging resources first: Atlas replica set, managed Redis, Cloudinary folder/account, SMTP sender, and Razorpay Test Mode application.
2. Complete the provider controls below and populate the staging values from [the environment matrix](environment-matrix.md).
3. Validate the full staging release and the go-live checklist.
4. Create distinct production resources and credentials. Never promote a staging database or reuse signing/webhook secrets.
5. Deploy the API and worker from the same reviewed commit, then build the web application with that API's HTTPS origin.
6. Add DNS only after origin health, WebSocket connectivity, CORS, cookies, and payment webhooks pass on the provider URLs.

## Render: API and worker

`render.yaml` defines two Docker services and deliberately sets `autoDeployTrigger: off`. It does not choose an instance size or contain secret values.

1. In Render, create a Blueprint from the reviewed repository and inspect the proposed `thread-api` and `thread-worker` services.
2. Select a region based on customer latency, Atlas/Redis region compatibility, data-processing requirements, and measured tests. Keep API, worker, Atlas, and Redis close enough to avoid avoidable latency.
3. Choose API and worker sizes from observed CPU, memory, event-loop delay, queue depth, and concurrency tests. Do not use a free/sleeping service for live checkout or workers.
4. Enter every `sync: false` value in Render's encrypted environment store. Render only prompts for these on initial Blueprint creation; later additions must be entered manually.
5. Ensure the API receives the platform `PORT`, has `/health/ready` configured as its health check, and has WebSocket support enabled.
6. Confirm the worker has no public route or port. Its healthy state is determined from process uptime, logs, BullMQ queue age/depth, failure rate, and dead-letter alerts.
7. Trigger staging deploys manually. Verify `GET /health/live` and `GET /health/ready`, then test an authenticated Socket.IO connection and a background email/reservation job.
8. For production, require a Render owner/operator to approve and start both deploys from the same commit. Deploy the worker first, then the API. Watch readiness and queues before proceeding.

Rollback by redeploying the last known-good API and worker commit together. Do not roll application code backward across an incompatible data transformation; follow the documented migration rollback or restore plan.

## Vercel: web

1. Import the repository through Vercel's Git integration.
2. Set the project Root Directory to `apps/web`; keep access to source files outside that directory enabled so workspace packages resolve.
3. Use the detected Next.js framework, pnpm lockfile, and Turborepo build settings. No repository `vercel.json` override is required.
4. Configure Preview variables with staging URLs/flags and Production variables with canonical production URLs/flags. Sensitive server credentials do not belong in Vercel because the web application must never receive them.
5. Keep preview deployments protected. If automated preview smoke tests are approved, store the Vercel automation bypass value only as the `staging` GitHub Environment secret `VERCEL_AUTOMATION_BYPASS_SECRET`.
6. Verify the preview, then require manual approval through the production GitHub/Vercel deployment control available to the client's plan and workflow. Do not promote automatically from an unreviewed merge.
7. After approval, promote the reviewed deployment and verify the canonical domain, assets, API calls, login cookies, and secure Socket.IO transport.

Run the optional preview browser check from GitHub Actions → **Preview smoke test** → **Run workflow**, entering the HTTPS Vercel preview URL. It never deploys.

## MongoDB Atlas

- Create a dedicated application database user for each environment with only `readWrite` access to that environment's THREAD database. Do not grant Atlas administration, cross-database, or backup privileges to the application user. Use a separate time-limited operator for index administration if organizational policy requires it.
- Permit network access only from the chosen hosting egress addresses or an approved private connection/peering arrangement. Never leave `0.0.0.0/0` in the production allowlist.
- Use an Atlas replica-set deployment because checkout uses transactions. Select the production tier only after representative load tests and measured working-set, connection, storage, IOPS, and growth requirements; record the decision. A free/shared tier is not a production capacity decision.
- Production disables Mongoose automatic index creation. Compare model-declared indexes against staging, review index build impact, apply approved indexes before traffic, and inspect slow-query/explain output after launch.
- Enable continuous backups/PITR at the tier-supported retention required by the approved policy. Restrict restore permissions, encrypt backups, and complete a timed restore drill into an isolated project before launch.
- Configure alerts for cluster availability, replication/oplog health, disk utilization and growth, connections, CPU, memory/cache pressure, query latency, and backup failures. Route alerts to named support owners.

## Managed Redis

- Require an authenticated `rediss://` endpoint with certificate validation. Never put Redis on the public internet without an IP allowlist; prefer provider private networking/peering where Render and the Redis provider support it.
- Use distinct staging and production instances/credentials. Restrict administrative access and rotate credentials through a planned dual-service restart.
- Confirm provider eviction policy and memory headroom are compatible with BullMQ and Socket.IO. Monitor memory, connections, command latency, queue age/depth, failed jobs, retries, and dead-letter growth.
- Document persistence and recovery expectations. Redis accelerates jobs/realtime but is not the system of record; test how pending jobs are reconciled after a provider restore or loss.

## Razorpay

1. SNAP CART completes merchant activation/KYC and verifies settlement bank details.
2. Integrators use only Razorpay Test Mode keys in local/staging and configure `https://STAGING_API/api/v1/payments/webhooks/razorpay`.
3. Select `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, and `refund.processed`; use a unique webhook secret per environment.
4. Test every approved payment method, webhook retries/out-of-order delivery, idempotency, failed-payment stock release, and client callback followed by server verification.
5. Confirm automatic versus manual capture with the client and finance owner. Do not fulfil until the authoritative captured/verified state is recorded.
6. Reconcile internal order IDs, Razorpay order/payment IDs, captures, fees, taxes, settlements, and exceptions on an approved schedule.
7. Complete a Test Mode refund, verify `refund.processed`, customer communication, order state, and reconciliation.
8. Only after sign-off, create live keys, store them in Render, configure the production webhook, make one controlled live payment and refund, and reconcile both.

`RAZORPAY_*_KEY_SECRET`, webhook secrets, signatures, and full webhook payloads must never reach the browser or logs. See [the detailed Razorpay checklist](razorpay-go-live.md).

## Cloudinary

- Keep the API secret only on API/worker hosting. Browsers request short-lived signed upload parameters from the API; unsigned unrestricted presets are not allowed.
- Restrict folder, resource type, MIME type, byte size, dimensions, and allowed transformations. Strip risky metadata and reject unsupported/corrupt media before catalogue use.
- Use stable public IDs and versioned URLs. Define reviewed responsive transformations for format/quality/crop rather than allowing arbitrary client transformations that increase cost.
- Separate staging and production folders or accounts and restrict deletion/admin credentials.
- Agree retention, original-file ownership, backup/export, deletion, and restore procedures with the client. Cloudinary delivery is not a substitute for the client's licensed source-media archive.

## Domain, HTTPS, email, and DNS

1. Record the client-authorized DNS owner, registrar, current records, TTLs, and rollback values before changes.
2. Verify the domain in Vercel and add the storefront apex/`www` records exactly as Vercel provides.
3. Add an `api` hostname in Render and create the exact DNS record Render provides. Do not proxy WebSockets through an incompatible intermediary.
4. Wait for managed certificates, verify the full chain and renewal, force HTTPS, and confirm HTTP redirects. Verify storefront, API, webhook, and `wss` from external networks.
5. Set canonical URLs, CORS origins, OAuth redirect URLs, cookie domain, Razorpay webhook URL, and Cloudinary callbacks to the final hostnames.
6. For the sending domain, publish the mail provider's SPF and DKIM records and a staged DMARC policy approved by the domain owner. Ensure there is only one valid SPF record, configure return-path/bounce handling, and test DMARC alignment.
7. Preserve MX and existing business-email records. Validate DNS with independent resolvers before reducing old records.

## Branch and release policy

- Protect `main`; block direct pushes, force pushes, deletion, and bypass except audited emergency owners.
- Require pull requests, at least one qualified approval (two for auth/payment/deployment changes), resolved conversations, signed/verified commits if organizational policy supports them, and an up-to-date branch.
- Require the `CI / Install, verify, test, and build` and `Security / dependency-and-secret-scan` checks. Add Vercel preview status and preview smoke status when the preview environment is available.
- Enable GitHub secret scanning/push protection, Dependabot, and dependency review where the repository plan supports it.
- Use protected GitHub `staging` and `production` Environments. Restrict production secrets and require named reviewers/manual approval.
- Preview deployments may be automatic for pull requests; production deployment remains a deliberate approval after checklist sign-off.

## Exact production release sequence

1. Freeze the reviewed commit SHA and attach passing CI/security/preview evidence.
2. Confirm the signed checklist and change window; snapshot/backup and record rollback targets.
3. Manually deploy the matching worker image and confirm queue connectivity.
4. Manually deploy the matching API image and wait for `/health/ready`.
5. Promote the matching Vercel web preview through the approved production gate.
6. Run smoke checks for HTTPS, WSS, authentication, catalogue, checkout, a controlled live payment, email, invoice, cancellation/refund, and monitoring.
7. Reconcile the payment/refund, verify logs contain no secrets, and record the release outcome.
8. If a release gate fails, stop traffic promotion and execute the documented application/data/provider rollback appropriate to the failure.
