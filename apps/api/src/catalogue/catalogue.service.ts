import { createHash } from "node:crypto";

import sanitizeHtml from "sanitize-html";
import {
  productWriteSchema,
  type CatalogueQuery,
  type ProductPatchInput,
  type ProductWriteInput,
  type VariantInput,
} from "@thread/validation";
import type { ProductMediaDto, ProductStatus } from "@thread/types";

import { HttpError } from "../middleware/error-handler.js";
import type { AuditRepository } from "../auth/repositories/audit.repository.js";
import type { AuthContext } from "../auth/auth.types.js";
import type { MediaProvider } from "./media/cloudinary.provider.js";
import type { AdminProductListInput, CatalogueRepository } from "./catalogue.types.js";
import type { ProductPreviewTokenService } from "./security/preview-token.js";
import type { CommerceJobQueue } from "../notifications/jobs/commerce-job.queue.js";
import { PublicCatalogueCache } from "./public-catalogue-cache.js";

const richTextOptions: sanitizeHtml.IOptions = {
  allowedTags: ["p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "br", "a", "blockquote"],
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }) },
  disallowedTagsMode: "discard",
};

function sanitized(value: string): string {
  return sanitizeHtml(value, richTextOptions).trim();
}
function csvCell(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? "" : String(value);
  // Spreadsheet applications can execute formula-like cells when an administrator
  // opens an export. Preserve the value while forcing those cells to plain text.
  const text = /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else current += char;
  }
  fields.push(current);
  return fields;
}
function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class CatalogueService {
  constructor(
    private readonly repository: CatalogueRepository,
    private readonly audits: AuditRepository,
    private readonly mediaProvider: MediaProvider,
    private readonly previews: ProductPreviewTokenService,
    private readonly jobs?: CommerceJobQueue,
    private readonly publicCache = new PublicCatalogueCache(),
  ) {}
  listPublic(query: CatalogueQuery) {
    return this.publicCache.get(`products:${JSON.stringify(query)}`, () =>
      this.repository.listPublic(query),
    );
  }
  facets(query: CatalogueQuery) {
    return this.publicCache.get(`facets:${JSON.stringify(query)}`, () =>
      this.repository.facets(query),
    );
  }
  suggestions(search: string) {
    return this.repository.suggestions(search);
  }
  async recordSearchAnalytics(query: string, resultCount: number): Promise<void> {
    const normalized = query.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
    await this.repository.recordSearchAnalytics({
      queryHash: createHash("sha256").update(normalized).digest("hex"),
      queryLength: normalized.length,
      resultCount,
    });
  }
  async detail(slug: string) {
    const product = await this.publicCache.get(`product:${slug}`, () =>
      this.repository.findPublicBySlug(slug),
    );
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    return product;
  }
  slugRedirect(slug: string) {
    return this.repository.findPublicSlugRedirect(slug);
  }
  related(slug: string, limit = 8) {
    const safeLimit = Math.min(12, Math.max(1, limit));
    return this.publicCache.get(`related:${slug}:${safeLimit}`, () =>
      this.repository.related(slug, safeLimit),
    );
  }
  listAdmin(input: AdminProductListInput) {
    return this.repository.listAdmin(input);
  }
  async adminDetail(id: string) {
    const product = await this.repository.findAdminById(id);
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    return product;
  }
  async create(input: ProductWriteInput, actorId: string, context: AuthContext) {
    const product = await this.catalogueWrite(() =>
      this.repository.create(
        { ...input, descriptionHtml: sanitized(input.descriptionHtml) },
        actorId,
      ),
    );
    await this.audit("catalogue.product_created", actorId, product.id, context, {
      status: product.status,
    });
    return product;
  }
  async update(id: string, input: ProductPatchInput, actorId: string, context: AuthContext) {
    const patch = { ...input } as ProductPatchInput;
    if (input.descriptionHtml !== undefined)
      patch.descriptionHtml = sanitized(input.descriptionHtml);
    const product = await this.catalogueWrite(() => this.repository.update(id, patch, actorId));
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await this.audit("catalogue.product_updated", actorId, id, context);
    return product;
  }
  async archive(id: string, actorId: string, context: AuthContext) {
    return this.changeStatus(id, "archived", "catalogue.product_archived", actorId, context);
  }
  async restore(id: string, actorId: string, context: AuthContext) {
    return this.changeStatus(id, "inactive", "catalogue.product_restored", actorId, context);
  }
  async replaceVariants(
    id: string,
    variants: readonly VariantInput[],
    actorId: string,
    context: AuthContext,
  ) {
    const product = await this.catalogueWrite(() =>
      this.repository.replaceVariants(id, variants, actorId),
    );
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await this.audit("catalogue.variant_matrix_updated", actorId, id, context, {
      variants: variants.length,
    });
    return product;
  }
  async bulkUpdate(
    productIds: readonly string[],
    update: { status?: ProductStatus; categoryIds?: readonly string[] },
    actorId: string,
    context: AuthContext,
  ) {
    const modified = await this.catalogueWrite(() =>
      this.repository.bulkUpdate(productIds, update),
    );
    await this.audit("catalogue.products_bulk_updated", actorId, productIds.join(","), context, {
      modified,
    });
    return { modified };
  }
  async previewToken(id: string, actorId: string, context: AuthContext) {
    await this.adminDetail(id);
    const token = await this.previews.issue(id);
    await this.audit("catalogue.preview_token_created", actorId, id, context);
    return { token, expiresInSeconds: 600 };
  }
  async preview(token: string) {
    let id: string;
    try {
      id = await this.previews.verify(token);
    } catch {
      throw new HttpError(401, "INVALID_PREVIEW_TOKEN", "Preview link is invalid or expired.");
    }
    return this.adminDetail(id);
  }
  async signedUpload(actorId: string, context: AuthContext) {
    await this.mediaProvider.verifyConfiguration?.();
    const result = this.mediaProvider.createSignedUpload();
    await this.audit("catalogue.upload_signature_created", actorId, result.folder, context);
    return result;
  }
  async attachMedia(
    id: string,
    media: Omit<ProductMediaDto, "sortOrder">,
    actorId: string,
    context: AuthContext,
  ) {
    if (!this.mediaProvider.validateMetadata(media))
      throw new HttpError(
        400,
        "INVALID_MEDIA_METADATA",
        "Uploaded media does not match the configured provider.",
      );
    const product = await this.catalogueWrite(() => this.repository.attachMedia(id, media));
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await this.audit("catalogue.media_attached", actorId, id, context, {
      publicId: media.publicId,
    });
    return product;
  }
  async reorderMedia(
    id: string,
    orderedPublicIds: readonly string[],
    primaryPublicId: string,
    actorId: string,
    context: AuthContext,
  ) {
    const product = await this.catalogueWrite(() =>
      this.repository.reorderMedia(id, orderedPublicIds, primaryPublicId),
    );
    if (!product)
      throw new HttpError(400, "INVALID_MEDIA_ORDER", "Media order does not match this product.");
    await this.audit("catalogue.media_reordered", actorId, id, context, { primaryPublicId });
    return product;
  }
  async removeMedia(id: string, publicId: string, actorId: string, context: AuthContext) {
    const product = await this.adminDetail(id);
    const media = product.media.find((item) => item.publicId === publicId);
    if (!media) throw new HttpError(404, "MEDIA_NOT_FOUND", "Media reference not found.");
    const removed = await this.repository.removeMediaReference(id, publicId);
    if (!removed) throw new HttpError(404, "MEDIA_NOT_FOUND", "Media reference not found.");
    this.publicCache.invalidate();
    const remainingReferences = await this.repository.countMediaReferences(publicId);
    const remoteDeleted =
      remainingReferences === 0 && !media.secureUrl.startsWith("/assets/approved/");
    if (remoteDeleted) await this.mediaProvider.delete(publicId);
    await this.audit("catalogue.media_removed", actorId, id, context, { publicId, remoteDeleted });
    return { remoteDeleted };
  }
  async adjustInventory(
    variantId: string,
    quantityDelta: number,
    reason: string,
    actorId: string,
    context: AuthContext,
  ) {
    let result: Awaited<ReturnType<CatalogueRepository["adjustInventory"]>>;
    try {
      result = await this.repository.adjustInventory({
        actorId,
        quantityDelta,
        reason,
        variantId,
        ...(context.requestId ? { requestId: context.requestId } : {}),
      });
    } catch (error) {
      throw new HttpError(
        400,
        "INVALID_INVENTORY_ADJUSTMENT",
        error instanceof Error ? error.message : "Inventory adjustment failed.",
      );
    }
    await this.audit("catalogue.inventory_adjusted", actorId, variantId, context, {
      quantityDelta,
      stockAfter: result.stockAfter,
    });
    await this.jobs?.enqueue({
      name: "inventory.low-stock",
      key: `inventory.low-stock:adjustment:${variantId}:${context.requestId ?? Date.now()}`,
      payload: { variantId },
    });
    this.publicCache.invalidate();
    return result;
  }
  async exportCsv(): Promise<string> {
    const products = await this.repository.exportAll();
    const header = [
      "product_id",
      "title",
      "slug",
      "status",
      "audience",
      "brand",
      "category_ids",
      "collection_ids",
      "sku",
      "colour",
      "size",
      "mrp_paise",
      "sale_price_paise",
      "available_stock",
    ];
    const rows = products.flatMap((product) =>
      product.variants.map((variant) => [
        product.id,
        product.title,
        product.slug,
        product.status,
        product.audience,
        product.brand,
        product.categoryIds.join("|"),
        product.collectionIds.join("|"),
        variant.sku,
        variant.colour,
        variant.size,
        variant.mrpPaise,
        variant.salePricePaise,
        variant.availableStock,
      ]),
    );
    return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }
  previewCsv(csv: string) {
    const lines = csv
      .replaceAll("\r\n", "\n")
      .split("\n")
      .filter((line) => line.trim());
    if (lines.length < 2)
      return {
        validRows: [],
        errors: [{ row: 1, message: "CSV must include a header and at least one row." }],
      };
    const headers = parseCsvLine(lines[0]!).map((value) => value.trim());
    const required = [
      "title",
      "slug",
      "audience",
      "brand",
      "sku",
      "colour",
      "size",
      "mrp_paise",
      "sale_price_paise",
    ];
    const missing = required.filter((name) => !headers.includes(name));
    if (missing.length)
      return {
        validRows: [],
        errors: [{ row: 1, message: `Missing columns: ${missing.join(", ")}` }],
      };
    const validRows: Record<string, string>[] = [];
    const errors: Array<{ row: number; message: string }> = [];
    lines.slice(1).forEach((line, lineIndex) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
      );
      const candidate = {
        title: row.title,
        slug: row.slug,
        shortDescription: row.short_description || row.title,
        descriptionHtml: row.description_html || `<p>${row.title}</p>`,
        categoryIds: row.category_ids ? row.category_ids.split("|") : [],
        collectionIds: row.collection_ids ? row.collection_ids.split("|") : [],
        audience: row.audience,
        brand: row.brand,
        tags: [],
        care: [],
        featured: false,
        status: "draft",
        seo: { noIndex: false },
        variants: [
          {
            sku: row.sku,
            colour: row.colour,
            size: row.size,
            attributes: {},
            mrpPaise: Number(row.mrp_paise),
            salePricePaise: Number(row.sale_price_paise),
            taxRateBps: null,
            hsn: row.hsn || null,
            weightGrams: Number(row.weight_grams || 200),
            status: "active",
          },
        ],
      };
      const result = productWriteSchema.safeParse(candidate);
      if (result.success) validRows.push(row);
      else
        errors.push({
          row: lineIndex + 2,
          message: result.error.issues[0]?.message ?? "Invalid row.",
        });
    });
    return { validRows, errors };
  }
  private async changeStatus(
    id: string,
    status: ProductStatus,
    action: string,
    actorId: string,
    context: AuthContext,
  ) {
    const product = await this.catalogueWrite(() => this.repository.setStatus(id, status));
    if (!product) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    await this.audit(action, actorId, id, context, { status });
    return product;
  }
  private async catalogueWrite<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.publicCache.invalidate();
      return result;
    } catch (error) {
      if (isDuplicateKey(error))
        throw new HttpError(
          409,
          "CATALOGUE_CONFLICT",
          "A product slug, SKU, or size and colour combination already exists.",
        );
      if (
        error instanceof Error &&
        ["INVALID_PRODUCT_ASSIGNMENT", "INVALID_VARIANT_MATRIX"].includes(error.message)
      )
        throw new HttpError(
          400,
          "INVALID_CATALOGUE_REFERENCE",
          "A category, collection, product, or variant reference is invalid.",
        );
      throw error;
    }
  }
  private audit(
    action: string,
    actorId: string,
    entityId: string,
    context: AuthContext,
    metadata?: Record<string, string | number | boolean>,
  ) {
    return this.audits.record({
      action,
      actorId,
      context,
      entity: "product",
      entityId,
      ...(metadata ? { metadata } : {}),
    });
  }
}
