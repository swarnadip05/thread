# Local development

## Prerequisites

- Docker Desktop or another Docker Compose-compatible runtime
- `nvm`
- Corepack

The repository pins Node.js 24.18.0 LTS and pnpm 11.15.0. Node 24 is selected because it is the current production LTS line supported by the workspace dependencies.

## First-time setup

Run these commands from the repository root:

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@11.15.0 --activate
pnpm install
pnpm assets:prepare
docker compose up -d mongo redis mongo-init
docker compose ps
```

`mongo-init` is an idempotent one-shot service. It configures MongoDB as the single-node `rs0` replica set required for local transaction testing. A successful run exits with status 0.

## Start both applications

```bash
nvm use
WEB_ORIGIN=http://localhost:3000 pnpm dev
```

The services are then available at:

- Web health page: <http://localhost:3000>
- API liveness: <http://localhost:4000/health/live>
- API readiness: <http://localhost:4000/health/ready>

The API intentionally requires `WEB_ORIGIN`; CORS accepts that exact origin. For persistent local configuration, copy the examples and fill in local values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

The example files contain variable names only. Do not commit populated environment files.

For local acceptance testing, set `NEXT_PUBLIC_API_URL=http://localhost:4000` and
`NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `apps/web/.env.local`. In
`apps/api/.env`, use the local MongoDB/Redis URLs, `WEB_ORIGIN=http://localhost:3000`,
`EMAIL_PROVIDER=local`, `PAYMENT_PROVIDER=mock`, and separate random values of at
least 32 characters for `ACCESS_TOKEN_SECRET` and `PRODUCT_PREVIEW_SECRET`.

Apply core settings/content migrations and then explicitly opt in to the
client-photography demo catalogue:

```bash
pnpm --filter @thread/api seed
DEMO_SEED_CONFIRM=SEED_THREAD_DEMO pnpm --filter @thread/api seed:demo
```

The demo seed is blocked in production. Its 73 products use approved photography
but intentionally labelled demonstration commerce data.

Online checkout uses `MockPaymentProvider` by default outside production. It
creates an internal/provider order and completes a simulated captured payment
without external credentials. To test Razorpay Test Mode instead, set:

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_MODE=test
RAZORPAY_TEST_KEY_ID=
RAZORPAY_TEST_KEY_SECRET=
RAZORPAY_TEST_WEBHOOK_SECRET=
```

Never place live keys in local files.

Background jobs and Socket.IO use the same local Redis service. Keep
`SOCKET_REDIS_ADAPTER_ENABLED=false` for a single local API process and
`EMAIL_PROVIDER=local` to use the non-delivery log adapter. See
`docs/realtime-and-jobs.md` for production scaling and SMTP settings.

## Optional Mongo Express

Mongo Express is bound to localhost and only starts through the development profile:

```bash
docker compose --profile development up -d mongo-express
```

Open <http://localhost:8081>. This local convenience service has authentication disabled and must not be exposed outside the development machine.

## Verification and checks

```bash
curl --fail http://localhost:4000/health/live
curl --fail http://localhost:4000/health/ready
pnpm check
```

To stop the applications, press `Ctrl+C`. To stop local infrastructure while preserving data:

```bash
docker compose down
```

To remove local database and Redis volumes, explicitly run `docker compose down --volumes`. This permanently deletes local development data.
