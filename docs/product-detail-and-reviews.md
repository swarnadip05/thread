# Product detail and review integration

## Purchase actions

The product page stores cart, wishlist and recently viewed state in versioned browser storage.
These values are convenience state only: prices, availability and quantity limits must be checked
again by the future cart/checkout API. `MAX_CART_QUANTITY` configures the product-page limit.

`DELIVERY_POSTAL_PREFIXES` accepts a comma-separated list of operational postcode prefixes. When
it is empty, the rules adapter returns `confirmation_required` and makes no delivery promise.

## Verified reviews

Checkout and the order domain are deliberately outside this phase. Review eligibility therefore
uses a narrow, read-only projection of the future `orders` collection instead of defining a partial
Order model. A qualifying record must have:

- `_id` matching the submitted order ID;
- `userId` matching the authenticated customer;
- `status: "delivered"`;
- an `items` entry whose `productId` matches the reviewed product.

The eventual order service owns that collection contract. Reviews are unique by
`userId + productId + orderId`, enter the moderation queue as `pending`, and affect product rating
aggregates only after approval.
