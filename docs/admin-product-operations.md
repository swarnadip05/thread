# Admin product operations

The existing admin shell is retained. Sign in at <http://localhost:3000/admin/login> using the existing email/password authentication. The customer login at `/auth/login` still works. Bootstrap, environment setup and exact startup commands are in [local development](local-development.md).

Catalogue screens require `super_admin`, `admin` or `catalog_manager`. API endpoints independently enforce these roles. Inventory and orders retain their existing workflows and audit trail. Product archival preserves order history.

## Add or edit a real product

1. Sign in, complete the initial password change, and open **Products → Add product**.
2. Enter name, slug, short/full description, audience, fit, material and verified care instructions.
3. Select categories and collections; create them in their sidebar sections if necessary.
4. Add each colour/size SKU with MRP, sale price, packaged weight, initial stock and low-stock threshold. Prices are entered in rupees and stored as integer paise; discount is calculated automatically.
5. Upload owned/licensed images and enter descriptive alt text. New uploads need the API's Cloudinary settings. Existing approved local demo images do not need Cloudinary.
6. Set Featured, New arrival and SEO fields, then save as Draft or **Active / published**.
7. Use **View product**, then check the homepage, category, collection and search pages. Edit through `/admin/products/[id]/edit`; unpublish or archive through Products or the status selector.

Product and variant changes are one MongoDB transaction. New stock is recorded in the inventory movement history. Existing stock is shown in the editor and adjusted through **Inventory → Adjust stock**, with a quantity delta and reason; editing copy/prices never overwrites reservations or stock. Existing variants can be made inactive, preserving order references.

Image transfer is a separate provider operation. Upload availability is checked before saving. A new product with selected images remains a draft until all uploads finish and the requested status is applied. If a transfer fails after creation, the UI keeps the saved product identity for retry instead of creating a duplicate. Select the failed files again to retry. Images can be removed or designated primary on the edit screen.

Admin writes cannot set rating/review aggregates or a manual best-seller flag. Best Sellers uses quantities from delivered orders only and is hidden when there are no qualifying sales. New Arrivals prefers explicitly marked products, with newest active products as the fallback when none are marked. Public product records always require Active status, a past publication time and at least one active variant; zero-stock variants are displayed as sold out.

SEO title, description and no-index are reflected on product detail pages. Public catalogue fetches do not retain stale browser/Next.js caches after admin publication; the API invalidates its short-lived query cache on catalogue changes. Homepage editorial photography is unchanged.
