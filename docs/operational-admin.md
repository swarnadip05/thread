# Operational admin

The operational workspace is available under `/admin/orders`, `/admin/returns`,
`/admin/inventory`, `/admin/customers`, `/admin/coupons`, `/admin/reviews` and
`/admin/settings`. API routes use `/api/v1/admin/operations`; customer return requests use
`/api/v1/returns`.

## Safety boundaries

- Order changes use the shared state machine in
  `apps/api/src/checkout/order-state-machine.ts`. Bulk changes are limited to
  `confirmed → processing` and `processing → packed`.
- Order items, totals, tax values and delivery addresses remain immutable snapshots. GST invoices
  use those snapshots and the configured legal business details; they do not calculate or invent a
  tax rate.
- Refund retries return the existing refund record before contacting the payment provider.
- A return is accepted only within the editable SiteSettings window after recorded delivery.
  Restocking requires an approved inspection and creates an inventory movement transactionally.
- Scoped coupons currently require every product in the cart to match a selected product or
  category. This prevents a whole-cart discount from applying to unrelated items before
  line-level coupon allocation is introduced.
- Customer contact details are returned only to operational roles, and detail views create audit
  records. Password, session and token fields are never selected.
- Public settings contain business content only. Provider secrets remain environment variables and
  are not part of the operational settings DTO or browser bundle.

Inventory CSV import is preview-only: rows are validated against current SKUs and reservations,
but no stock is changed. Approved changes must use a reasoned manual adjustment so an
`InventoryMovement` is recorded.
