# THREAD security and reliability

## Security boundaries

- The API CSP is intentionally API-only: no scripts, styles, images, frames, or forms. CORS accepts only exact origins from `CORS_ORIGINS`; requests without an Origin remain available to trusted server-to-server clients.
- Browser mutations with a body must use `application/json`. JSON is limited to 1 MiB, while Razorpay's isolated raw webhook body is limited to 256 KiB and verified before parsing.
- Refresh cookies are `HttpOnly`, `SameSite=Strict`, scoped to the auth path, and `Secure` in production. Cookie-authenticated refresh/logout operations require the double-submit CSRF value and exact configured Origin.
- Route schemas strip or reject fields before services receive them. Mongoose schemas use strict mode and repository methods map public DTOs rather than serializing documents.
- Product uploads use signed Cloudinary requests and constrained MIME type, format, dimensions, byte size, folder, and metadata validation. SVG is not accepted.
- Logs redact authentication, CSRF, idempotency, payment-signature, password, token, address, email, phone, and provider-payload fields.

## Data protection

- Collect only customer identity, delivery, order, and support data required for the transaction.
- `DELETE /api/v1/auth/account` requires an authenticated customer, CSRF token, current password, and the exact confirmation phrase. It revokes sessions/tokens, deletes saved addresses, removes login identifiers, and disables the anonymized identity. Immutable order/tax snapshots remain for operational and statutory retention.
- Privileged staff identities require assisted deletion so the audit trail is not silently broken.
- Expired/revoked session metadata is removed after `PII_RETENTION_DAYS` (default 365). Auth tokens and active session documents also have expiry indexes.
- Production MongoDB must use `mongodb+srv`, Redis must use `rediss`, SMTP must enable encrypted transport, and outbound alert hooks must use HTTPS.
- Development, staging, and production must use separate Atlas projects/databases, Redis instances, Razorpay modes, Cloudinary folders, email credentials, and secret stores. Production data must never be copied to laptops or local Docker volumes.

## Backups and restore drills

Use Atlas continuous backups or scheduled snapshots with encryption and a retention period approved by SNAP CART. Restrict restore privileges to named production operators.

Quarterly, restore the newest snapshot into an isolated, access-restricted recovery project. Verify document counts, indexes, a sample order timeline, payment/order linkage, and inventory totals; then destroy the recovery environment. Record recovery point, recovery time, operator, discrepancies, and remediation without copying customer data locally.

## Reliability behavior

- Readiness reports only dependency names and `up`/`down`; it exposes no hostnames or credentials.
- The five-minute reconciliation task releases expired reservations, polls only non-terminal provider payments, checks reserved-stock totals against active reservations, and removes expired session metadata.
- Provider payment polling is a read-only/idempotent operation. Non-idempotent payment creation, capture conversion, refunds, webhooks, reservations, and queued work retain application idempotency keys.
- Stock mismatches raise an alert and are not auto-corrected while checkout is live. Follow the stock runbook and use an audited inventory adjustment.
- Background jobs have bounded exponential retries and exhausted jobs are copied to the dead-letter queue.
- `ALERT_WEBHOOK_URL` is optional; alerts are always emitted as structured logs and may additionally be forwarded over HTTPS.

## Environment separation checklist

- Use unique database and Redis names/credentials per environment.
- Never use live Razorpay keys outside production.
- Restrict production network access and rotate secrets after personnel or provider changes.
- Confirm maintenance mode, online payment, COD, phone OTP, TOTP, and guest checkout flags independently in each environment.
