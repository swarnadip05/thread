# Checkout domain

Checkout preparation and stock reservation are provider-neutral. Online
payments are connected through the payment provider abstraction; the browser
never receives provider secrets or payment credentials.

## Money and pricing

- All monetary values are integer paise.
- Product and variant data is re-fetched by the API when a checkout session is
  created. Browser totals are never trusted.
- Tax is calculated only when a variant has an explicitly configured tax rate.
  An absent tax configuration contributes no tax; the application does not
  invent a GST rate or HSN code.
- Shipping charges and free-shipping thresholds come from active
  `ShippingMethod` records.
- Checkout responses flag products whose current sale price differs from the
  price observed by the browser.

## Reservation lifecycle

Creating a checkout session runs in a MongoDB transaction. Each requested
variant is reserved with an atomic availability check:

`stockOnHand - stockReserved >= requested quantity`

The transaction increments `stockReserved` and creates a
`StockReservation`. After commit, BullMQ schedules a delayed expiry job using
the configured reservation duration. If scheduling fails, the service releases
the reservation so stock is not stranded.

Expiry, cancellation, and definitive payment failure release reserved stock
idempotently. Confirming a COD order, or a verified captured payment,
decrements both `stockOnHand` and `stockReserved`, records inventory movements,
creates the order and payment record, and marks reservations committed in one
MongoDB transaction.

Redis must be available for checkout session creation because reservation
expiry is a correctness requirement, not an optional notification.

## Idempotency and identifiers

The `Idempotency-Key` request header is required when creating a checkout.
Keys are stored as hashes and are unique per user. Reusing the same key returns
the original session rather than creating another reservation.

Orders use MongoDB IDs internally and a separate public identifier in the form
`THR-YYYY-000001`. Payment-provider order and payment identifiers have separate
fields and are never used as the THREAD order identifier.

## COD and shipping

Guest checkout and COD are disabled by default. Administrators can configure:

- reservation duration;
- COD enablement;
- minimum and maximum order value;
- allowed postcode prefixes;
- whether explicit COD confirmation is required;
- shipping methods, rates, free-shipping thresholds, and COD eligibility.

The first shipping provider is a rules-based manual adapter. Its interface is
designed to be replaced by a courier integration without changing checkout
pricing or order persistence.

## Payment boundary

The browser callback is authenticated but is not authoritative. THREAD verifies
its signature and then checks the payment with the provider. Captured,
amount-matched payments and verified `payment.captured`/`order.paid` webhooks
enter the same idempotent stock-conversion transaction.

Payment-provider identifiers remain separate from THREAD order identifiers.
Card numbers, CVV, UPI PINs and full provider payloads are never persisted.
See [Razorpay go-live](./razorpay-go-live.md) before enabling production keys.
