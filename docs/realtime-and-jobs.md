# Real-time events and background jobs

## Socket.IO

The API attaches Socket.IO to the same persistent HTTP server as Express. The
handshake accepts the existing short-lived access token through
`handshake.auth.token`; refresh cookies are never exposed to Socket.IO.

Authenticated sockets automatically join their own `user:{userId}` room.
Administrative roles join `role:admin`, and order-management roles also join
`role:order_manager`. Explicit `order:{orderId}` joins verify ownership for
customers. Events contain IDs, status and stock summaries only—never addresses,
provider payloads or payment signatures.

The browser reconnects with bounded exponential delay, rejoins requested order
rooms after reconnect and retains REST polling as a fallback.

For multiple API instances:

```dotenv
SOCKET_REDIS_ADAPTER_ENABLED=true
REDIS_URL=rediss://user:password@private-managed-redis.example:6379
```

Redis must be reachable only from the API/worker private network, require
authentication and use TLS when traffic leaves a trusted private network.
Never expose Redis to browsers or a public allow-all network rule.

## BullMQ

The `thread-commerce-jobs` queue handles:

- reservation release;
- order-confirmation and status email;
- password-reset and verification email;
- newsletter confirmation;
- low-stock evaluation and alerts;
- invoice generation.

Every job has a deterministic business key. BullMQ suppresses duplicate queued
jobs, while `JobExecution` records prevent completed work from running again
after BullMQ retention expires. Failed or stale executions can be reacquired
for retry. Jobs retry five times with exponential backoff. Exhausted jobs add a
metadata-only record to `thread-commerce-dead-letter`; password and verification
tokens are deliberately excluded from dead-letter payloads.

Invoices are generated from immutable order snapshots and current business
identity settings. No tax percentage, HSN code or certification is invented.
PDFs are private and can only be downloaded by the owning customer.

## Email

Local development uses the log adapter:

```dotenv
EMAIL_PROVIDER=local
```

Production startup requires the configured SMTP adapter:

```dotenv
EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=true
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

Keep SMTP credentials in the hosting provider's encrypted environment store.
The provider interface can be replaced by an approved transactional-email
adapter without changing job handlers.
