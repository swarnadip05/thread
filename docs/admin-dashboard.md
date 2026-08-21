# Admin dashboard

`GET /api/v1/admin/dashboard` is restricted to `super_admin`, `admin`, and `order_manager`. It calculates revenue only from orders with a captured payment record; totals are integer paise and are never accepted from the browser.

The selected period is applied to order creation time. The comparison value uses the immediately preceding period of the same duration. Revenue, paid orders, average order value, top products, sales points, payment state counts, low-stock variants, return requests, and new-customer counts are calculated server-side through repository aggregations.

The CSV export intentionally contains only order number, timestamps, operational/payment statuses, item count, and total paise. It never contains a customer name, address, phone number, email address, or payment-provider payload. Every export creates an audit event.

The dashboard listens for authenticated `admin.dashboard.updated`, `order.created`, and `payment.updated` events. A normal API refresh remains available for reconnect or recovery; no dashboard data is embedded in the client bundle.
