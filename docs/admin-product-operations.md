# Admin product operations

The protected product workspace is available at
<http://localhost:3000/admin/products>. It requires a `super_admin`, `admin`, or
`catalog_manager` account.

## First local administrator

Start MongoDB, run the normal seed, and then perform the one-time bootstrap:

```bash
docker compose up -d mongo redis mongo-init
pnpm --filter @thread/api seed
ADMIN_BOOTSTRAP_NAME="Local Administrator" \
ADMIN_BOOTSTRAP_EMAIL="your-admin-email@example.com" \
ADMIN_BOOTSTRAP_PASSWORD="replace-with-a-unique-14-plus-character-password" \
ADMIN_BOOTSTRAP_CONFIRM="CREATE_THREAD_SUPER_ADMIN" \
pnpm --filter @thread/api bootstrap:admin
```

Use a local-only password and do not paste a production password into shell
history. The bootstrap refuses to create a second super administrator and forces
a password change on first login.

## Adding a product

1. Start the API and web app with `WEB_ORIGIN=http://localhost:3000 pnpm dev`.
2. Open <http://localhost:3000/auth/login>, sign in, and complete the required password
   change.
3. Open **Admin → Products → Add product**.
4. Enter the product copy, audience, category, fit, initial SKU, colour, size, MRP,
   sale price, and packaged weight.
5. Keep the product as **Draft** until its product facts, image rights, price, and
   category have been reviewed.
6. Open **Admin → Inventory**, find the new SKU, and use **Adjust stock** with a
   meaningful reason. New variants intentionally start with zero stock.
7. Activate the product only after at least one sellable variant has stock and all
   customer-facing details are correct.

Money entered in the admin is converted to integer paise before it reaches the API.
The API validates that sale price does not exceed MRP. Tax rate, HSN, material, and
unverified marketing claims are not guessed.

## Product images

The demo catalogue uses the approved local THREAD images prepared by
`pnpm assets:prepare`. To upload a new image from the Products form, configure the
API with a Cloudinary cloud name, API key, API secret, and restricted product
folder. Uploads use a server-issued signature; the API secret is never sent to the
browser.

If Cloudinary is not configured, create the product without selecting an image.
Do not upload reference screenshots, competitor assets, or images without recorded
client ownership/licensing approval. Use descriptive alt text.

## Useful verification

```bash
curl --fail http://localhost:4000/health/live
curl --fail http://localhost:4000/health/ready
pnpm check
```

For a populated local catalogue using the approved client photography:

```bash
DEMO_SEED_CONFIRM=SEED_THREAD_DEMO pnpm --filter @thread/api seed:demo
```

Demo records are clearly labelled and the command is blocked in production. Review
and replace all demonstration prices, SKUs, descriptions, inventory, tax/HSN data,
and product names before a client launch.
