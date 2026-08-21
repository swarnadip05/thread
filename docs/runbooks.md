# THREAD operational runbooks

Every incident starts by recording UTC time, environment, request/order identifiers, deployment version, and incident owner. Never paste secrets, full addresses, tokens, signatures, or raw provider payloads into tickets or chat.

## Payment succeeded but order pending

1. Search by internal order number and masked provider payment ID.
2. Confirm the amount, currency, provider order ID, captured status, checkout session, and reservation expiry.
3. Trigger or wait for payment reconciliation; do not create another internal order.
4. If captured payment remains unmatched, disable fulfilment for that order, alert engineering, and reconcile through the idempotent confirmation transaction.
5. Refund only through the authorised refund operation if confirmation cannot safely complete.

## Webhook outage

1. Confirm API readiness, Razorpay endpoint status, signature failures, and provider delivery attempts.
2. Keep provider polling/reconciliation running; do not accept browser callback data as payment authority.
3. Restore the endpoint or deployment and allow provider retries.
4. Compare provider events with stored webhook event hashes and process each event once.

## Stock mismatch

1. Pause affected variants or enable maintenance mode if overselling risk is broad.
2. Compare active `StockReservation` totals with each variant's `stockReserved`.
3. Inspect recent inventory movements, payment confirmations, expiries, and request IDs.
4. Correct through an audited manual inventory adjustment with a precise reason.
5. Re-run the consistency check before reactivating sales.

## Email failure

1. Check queue state, dead-letter records, SMTP/transactional-provider health, and domain status.
2. Fix credentials or provider availability without logging message tokens.
3. Requeue only idempotent message jobs using their original deduplication key.
4. For time-limited auth mail, issue a new token rather than replaying an expired one.

## Redis outage

1. Checkout creation must fail closed if reservation expiry cannot be scheduled.
2. Keep the API running only if readiness and operational policy permit; real-time clients use polling fallback.
3. Restore private authenticated Redis, start workers, and run reservation reconciliation immediately.
4. Inspect delayed and dead-letter jobs before reopening checkout.

## Database outage

1. Readiness must report database `down`; stop traffic or enable the maintenance page.
2. Check Atlas status, network allowlists, certificates, pool exhaustion, and recent deploys.
3. Do not switch to an unverified stale copy or local production-data export.
4. After recovery, run payment, reservation, and inventory reconciliation before reopening checkout.

## Rollback

1. Enable maintenance mode when schema or transaction compatibility is uncertain.
2. Roll back to the last known compatible application version; never roll back data with an application deploy.
3. Apply a reviewed forward data migration when necessary.
4. Verify health, auth, public catalogue, checkout reservation, webhook signature handling, and one test-mode payment before restoring traffic.
