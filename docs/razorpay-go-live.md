# Razorpay go-live checklist

THREAD uses Razorpay Standard Checkout through a replaceable `PaymentProvider`.
Local development and automated tests use `MockPaymentProvider`; production
must use live Razorpay credentials.

## Environment

Keep all values in the hosting provider's encrypted environment store. Never
commit them.

```dotenv
PAYMENT_PROVIDER=razorpay
RAZORPAY_MODE=live
RAZORPAY_LIVE_KEY_ID=
RAZORPAY_LIVE_KEY_SECRET=
RAZORPAY_LIVE_WEBHOOK_SECRET=
```

Test mode uses the corresponding `RAZORPAY_TEST_*` names. Production startup
fails if the provider is not Razorpay, mode is not `live`, or any live
credential is absent.

## Merchant account

- Complete Razorpay account activation and business verification.
- Confirm the account name and settlement bank details with SNAP CART.
- Enable only payment methods approved by the client.
- Confirm cards, UPI Intent on mobile, and dynamic QR on desktop in the merchant
  account. Standard Checkout controls availability.
- Do not add a manual UPI-ID collection field. Razorpay documents the migration
  toward Intent and QR flows in its
  [UPI guidance](https://razorpay.com/docs/payments/payment-methods/upi/).
- Confirm automatic capture is enabled or establish an approved capture
  process. THREAD fulfils only captured, verified payments.

## Webhooks

Configure this HTTPS endpoint in both Razorpay Test and Live dashboards:

```text
https://API_HOST/api/v1/payments/webhooks/razorpay
```

Subscribe to:

- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.processed`

Use a unique high-entropy webhook secret for each mode. The API verifies the
signature against the untouched raw request body and deduplicates
`x-razorpay-event-id`, following Razorpay's
[webhook validation guidance](https://razorpay.com/docs/webhooks/validate-test/).

## Pre-launch verification

- Run a complete Test Mode payment for each enabled method.
- Verify successful checkout first shows pending verification when appropriate,
  then a THREAD receipt.
- Verify closing Checkout can be retried without creating another internal
  order.
- Verify failed payments release reserved stock.
- Replay a webhook and confirm inventory is converted only once.
- Deliver captured and failed events out of order and confirm captured state is
  not downgraded.
- Verify a full admin refund and `refund.processed` reconciliation.
- Confirm API and application logs contain no signatures, secrets, tokens or
  full webhook payloads.
- Confirm MongoDB is a replica set and Redis/BullMQ is healthy.
- Rotate any key used outside the intended environment.

Razorpay's
[Standard Checkout integration steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
and [order API](https://razorpay.com/docs/api/orders/create/) remain the source
of truth for provider-specific activation requirements.
