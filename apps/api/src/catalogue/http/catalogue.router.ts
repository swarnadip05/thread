import { Router, type Request, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ZodType } from "@thread/validation";
import {
  bulkProductUpdateSchema,
  catalogueQuerySchema,
  inventoryAdjustmentSchema,
  mediaAttachSchema,
  mediaDeleteSchema,
  mediaReorderSchema,
  productSuggestionQuerySchema,
  productPatchSchema,
  productWriteSchema,
  searchAnalyticsSchema,
  deliveryCheckSchema,
  reviewCreateSchema,
  reviewListQuerySchema,
  reviewModerationSchema,
  reviewUpdateSchema,
  variantMatrixSchema,
} from "@thread/validation";
import type { ProductAudience, ProductStatus } from "@thread/types";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  createOriginGuard,
  requireCsrf,
  requireRoles,
  validateBody,
} from "../../auth/http/security.middleware.js";
import { HttpError } from "../../middleware/error-handler.js";
import multer from "multer";
import type { CatalogueService } from "../catalogue.service.js";
import { ProductImportService } from "../product-import.service.js";
import type { DeliveryEligibilityProvider } from "../delivery/delivery.provider.js";
import type { ReviewService } from "../reviews/review.service.js";
import { ProductModel } from "../models/product.model.js";
import { ProductVariantModel } from "../models/product-variant.model.js";

function context(request: Request): AuthContext {
  const userAgent = request.header("user-agent")?.slice(0, 512);
  return {
    ...(request.ip ? { ip: request.ip } : {}),
    requestId: request.requestId,
    ...(userAgent ? { userAgent } : {}),
  };
}
function parameter(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
function query<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      result.error.issues[0]?.message ?? "Query is invalid.",
    );
  return result.data;
}
function adminListQuery(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const page = Math.max(1, Number(record.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(record.limit) || 25));
  const statuses: ProductStatus[] = ["draft", "active", "inactive", "archived"];
  const audiences: ProductAudience[] = ["men", "women", "unisex", "accessories"];
  const status =
    typeof record.status === "string" && statuses.includes(record.status as ProductStatus)
      ? (record.status as ProductStatus)
      : undefined;
  const audience =
    typeof record.audience === "string" && audiences.includes(record.audience as ProductAudience)
      ? (record.audience as ProductAudience)
      : undefined;
  const text = (name: string, length: number) =>
    typeof record[name] === "string" ? record[name].trim().slice(0, length) : undefined;
  const search = text("search", 120);
  const categoryId = text("categoryId", 24);
  const collectionId = text("collectionId", 24);
  const sku = text("sku", 64);
  return {
    page,
    limit,
    ...(status ? { status } : {}),
    ...(audience ? { audience } : {}),
    ...(search ? { search } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(sku ? { sku } : {}),
  };
}

export function createCatalogueRouter(
  service: CatalogueService,
  authenticateAdmin: RequestHandler,
): Router;
export function createCatalogueRouter(
  service: CatalogueService,
  reviews: ReviewService,
  delivery: DeliveryEligibilityProvider,
  authenticateAdmin: RequestHandler,
  options: { maxCartQuantity: number; webOrigin: string },
  productImportService?: ProductImportService,
): Router;
export function createCatalogueRouter(
  service: CatalogueService,
  reviewsOrAuthentication: ReviewService | RequestHandler,
  deliveryProvider?: DeliveryEligibilityProvider,
  authentication?: RequestHandler,
  configuredOptions?: { maxCartQuantity: number; webOrigin: string },
  productImportService?: ProductImportService,
): Router {
  const reviews =
    typeof reviewsOrAuthentication === "function" ? undefined : reviewsOrAuthentication;
  const authenticateAdmin =
    typeof reviewsOrAuthentication === "function" ? reviewsOrAuthentication : authentication!;
  const delivery = deliveryProvider ?? {
    check: async (postalCode: string) => ({
      postalCode,
      status: "confirmation_required" as const,
      message: "Postcode accepted. Delivery availability will be confirmed before dispatch.",
    }),
  };
  const options = configuredOptions ?? {
    maxCartQuantity: 10,
    webOrigin: "http://localhost:3000",
  };
  const router = Router();
  const importService = productImportService ?? new ProductImportService();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  });
  const catalogueRoles = requireRoles("super_admin", "admin", "catalog_manager");
  const inventoryRoles = requireRoles("super_admin", "admin", "catalog_manager", "order_manager");
  const reviewModerationRoles = requireRoles(
    "super_admin",
    "admin",
    "catalog_manager",
    "support_agent",
  );
  const stateChangeSecurity = [createOriginGuard(options.webOrigin), requireCsrf];
  const cachePublicCatalogue = (_request: Request, response: Response, next: () => void) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  };

  router.get("/catalog/config", (_request, response) =>
    response.json({ success: true, data: { maxQuantity: options.maxCartQuantity } }),
  );
  router.post(
    "/catalog/delivery/check",
    rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    validateBody(deliveryCheckSchema),
    async (request, response) =>
      response.json({ success: true, data: await delivery.check(request.body.postalCode) }),
  );

  router.get("/catalog/products", cachePublicCatalogue, async (request, response) =>
    response.json({
      success: true,
      data: await service.listPublic(query(catalogueQuerySchema, request.query)),
    }),
  );
  router.get("/catalog/products/facets", cachePublicCatalogue, async (request, response) =>
    response.json({
      success: true,
      data: await service.facets(query(catalogueQuerySchema, request.query)),
    }),
  );
  router.get("/catalog/search/suggestions", async (request, response) => {
    const input = query(productSuggestionQuerySchema, request.query);
    response.json({ success: true, data: await service.suggestions(input.q) });
  });
  router.post(
    "/catalog/search/events",
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many search events." },
      },
    }),
    validateBody(searchAnalyticsSchema),
    async (request, response) => {
      await service.recordSearchAnalytics(request.body.query, request.body.resultCount);
      response.status(202).json({ success: true, data: { accepted: true } });
    },
  );
  router.get("/catalog/products/preview/:token", async (request, response) =>
    response.json({ success: true, data: await service.preview(parameter(request, "token")) }),
  );
  router.get("/catalog/products/:slug/redirect", cachePublicCatalogue, async (request, response) =>
    response.json({
      success: true,
      data: { slug: await service.slugRedirect(parameter(request, "slug")) },
    }),
  );
  router.get("/catalog/products/:slug/related", cachePublicCatalogue, async (request, response) =>
    response.json({
      success: true,
      data: await service.related(parameter(request, "slug"), Number(request.query.limit) || 8),
    }),
  );
  if (reviews) {
    router.get("/catalog/products/:slug/reviews", async (request, response) =>
      response.json({
        success: true,
        data: await reviews.listBySlug(
          parameter(request, "slug"),
          query(reviewListQuerySchema, request.query),
        ),
      }),
    );
    router.post(
      "/catalog/products/:productId/reviews",
      ...stateChangeSecurity,
      authenticateAdmin,
      rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false }),
      validateBody(reviewCreateSchema),
      async (request, response) =>
        response.status(201).json({
          success: true,
          data: await reviews.create(
            request.auth!.userId,
            parameter(request, "productId"),
            request.body,
            context(request),
          ),
        }),
    );
    router.patch(
      "/catalog/reviews/:id",
      ...stateChangeSecurity,
      authenticateAdmin,
      validateBody(reviewUpdateSchema),
      async (request, response) =>
        response.json({
          success: true,
          data: await reviews.update(
            request.auth!.userId,
            parameter(request, "id"),
            request.body,
            context(request),
          ),
        }),
    );
  }
  router.get("/catalog/products/:slug", cachePublicCatalogue, async (request, response) =>
    response.json({ success: true, data: await service.detail(parameter(request, "slug")) }),
  );

  router.use("/admin", authenticateAdmin);
  if (reviews)
    router.get("/admin/reviews", reviewModerationRoles, async (request, response) => {
      const parsed = query(reviewListQuerySchema, request.query);
      const rawStatus = typeof request.query.status === "string" ? request.query.status : undefined;
      const status =
        rawStatus === "pending" || rawStatus === "approved" || rawStatus === "rejected"
          ? rawStatus
          : undefined;
      response.json({
        success: true,
        data: await reviews.listAdmin({ ...parsed, ...(status ? { status } : {}) }),
      });
    });
  if (reviews)
    router.patch(
      "/admin/reviews/:id/moderation",
      ...stateChangeSecurity,
      reviewModerationRoles,
      validateBody(reviewModerationSchema),
      async (request, response) =>
        response.json({
          success: true,
          data: await reviews.moderate(
            parameter(request, "id"),
            request.body.status,
            request.body.reason,
            request.auth!.userId,
            context(request),
          ),
        }),
    );
  router.get("/admin/products", catalogueRoles, async (request, response) =>
    response.json({ success: true, data: await service.listAdmin(adminListQuery(request.query)) }),
  );
  router.get("/admin/products/export.csv", catalogueRoles, async (_request, response) => {
    response
      .type("text/csv")
      .attachment("thread-products.csv")
      .send(await service.exportCsv());
  });
  router.post(
    "/admin/products/import-preview",
    catalogueRoles,
    upload.single("file"),
    async (request, response) => {
      let buffer: Buffer | null = null;
      let filename = "import.xlsx";

      if (request.file) {
        buffer = request.file.buffer;
        filename = request.file.originalname;
      } else if (request.body?.fileBase64) {
        buffer = Buffer.from(String(request.body.fileBase64), "base64");
        filename = String(request.body.filename || "import.xlsx");
      } else if (request.body?.csv) {
        buffer = Buffer.from(String(request.body.csv), "utf-8");
        filename = "import.csv";
      }

      if (!buffer) {
        throw new HttpError(
          400,
          "MISSING_FILE",
          "Please upload a file (.zip, .xlsx, .xls, .csv, .json) or provide fileBase64.",
        );
      }

      const preview = await importService.previewImport(buffer, filename);
      response.json({ success: true, data: preview });
    },
  );

  router.post(
    "/admin/products/import",
    catalogueRoles,
    upload.single("file"),
    async (request, response) => {
      let buffer: Buffer | null = null;
      let filename = "import.xlsx";

      if (request.file) {
        buffer = request.file.buffer;
        filename = request.file.originalname;
      } else if (request.body?.fileBase64) {
        buffer = Buffer.from(String(request.body.fileBase64), "base64");
        filename = String(request.body.filename || "import.xlsx");
      } else if (request.body?.csv) {
        buffer = Buffer.from(String(request.body.csv), "utf-8");
        filename = "import.csv";
      }

      if (!buffer) {
        throw new HttpError(
          400,
          "MISSING_FILE",
          "Please upload a file (.zip, .xlsx, .xls, .csv, .json) or provide fileBase64 to import.",
        );
      }

      try {
        const result = await importService.executeImport(
          buffer,
          filename,
          request.auth!.userId,
          context(request),
        );
        response.json({ success: true, data: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpError(400, "IMPORT_FAILED", `Import execution failed: ${msg}`);
      }
    },
  );
  router.post("/admin/products/import-zip", catalogueRoles, async (request, response) => {
    let zipBuffer: Buffer;
    if (typeof request.body?.zipBase64 === "string") {
      zipBuffer = Buffer.from(request.body.zipBase64, "base64");
    } else if (Buffer.isBuffer(request.body)) {
      zipBuffer = request.body;
    } else {
      throw new HttpError(
        400,
        "MISSING_ZIP_DATA",
        "ZIP data must be provided as base64 string or raw buffer.",
      );
    }
    const result = await service.importZipInventory(
      zipBuffer,
      request.auth!.userId,
      context(request),
    );
    response.json({ success: true, data: result });
  });
  router.post("/admin/products/auto-seed-100", catalogueRoles, async (request, response) => {
    const { create100InventoryZipBuffer } = await import("../zip-importer.js");
    const zipBuffer = await create100InventoryZipBuffer();
    const result = await service.importZipInventory(
      zipBuffer,
      request.auth!.userId,
      context(request),
    );
    response.json({ success: true, data: result });
  });

  // ── Batch photo upload wizard ────────────────────────────────────────────────
  const uploadMany = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
  router.post(
    "/admin/products/batch-upload",
    catalogueRoles,
    uploadMany.array("files", 500),
    async (request, response) => {
      const files = (request.files as Express.Multer.File[]) ?? [];
      if (!files.length) throw new HttpError(400, "NO_FILES", "No images were uploaded.");
      const body = request.body as Record<string, string>;
      const audience = (body.audience || "unisex") as "men" | "women" | "unisex";
      const categorySlug = body.category || "oversized-t-shirts";
      const categoryName =
        categorySlug === "oversized-t-shirts" ? "Oversized T-Shirts" : "Classic Fit T-Shirts";
      const imagesPerProduct = Math.max(1, Math.min(20, Number(body.imagesPerProduct) || 5));
      const priceSMPaise = Math.round((Number(body.priceSM) || 549) * 100);
      const priceLXLPaise = Math.round((Number(body.priceLXL) || 599) * 100);
      const priceXXLPaise = Math.round((Number(body.priceXXL) || 649) * 100);
      const mrpPaise = Math.round((Number(body.mrp) || 899) * 100);
      const stockPerSize = Math.max(1, Number(body.stockPerSize) || 25);
      const productType = (body.productType || "oversized") as "oversized" | "regular";
      try {
        const result = await importService.batchUploadFromImages({
          files: files.map((f) => ({
            buffer: f.buffer,
            filename: f.filename || f.originalname,
            originalname: f.originalname,
          })),
          audience,
          categorySlug,
          categoryName,
          imagesPerProduct,
          priceSMPaise,
          priceLXLPaise,
          priceXXLPaise,
          mrpPaise,
          stockPerSize,
          productType,
          actorId: request.auth!.userId,
        });
        response.json({ success: true, data: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new HttpError(400, "BATCH_UPLOAD_FAILED", `Batch upload failed: ${msg}`);
      }
    },
  );

  // ── Clear products (admin reset) ────────────────────────────────────────────
  router.post("/admin/products/clear-all", catalogueRoles, async (request, response) => {
    const onlyWithoutImages = request.body?.onlyWithoutImages === true;

    if (onlyWithoutImages) {
      const wrongProducts = await ProductModel.find({
        $or: [
          { media: { $exists: false } },
          { media: { $size: 0 } },
          { "media.0": { $exists: false } },
        ],
      })
        .select("_id")
        .lean();

      const wrongIds = wrongProducts.map((p) => p._id);
      const [products, variants] = await Promise.all([
        ProductModel.deleteMany({ _id: { $in: wrongIds } }),
        ProductVariantModel.deleteMany({ productId: { $in: wrongIds } }),
      ]);
      response.json({
        success: true,
        data: { deletedProducts: products.deletedCount, deletedVariants: variants.deletedCount },
      });
      return;
    }

    const [products, variants] = await Promise.all([
      ProductModel.deleteMany({}),
      ProductVariantModel.deleteMany({}),
    ]);
    response.json({
      success: true,
      data: { deletedProducts: products.deletedCount, deletedVariants: variants.deletedCount },
    });
  });

  // ── Delete single product ──────────────────────────────────────────────────
  router.delete("/admin/products/:id", catalogueRoles, async (request, response) => {
    const id = parameter(request, "id");
    await Promise.all([
      ProductModel.deleteOne({ _id: id }),
      ProductVariantModel.deleteMany({ productId: id }),
    ]);
    response.json({ success: true, data: { deleted: true } });
  });

  // ── Bulk delete products ───────────────────────────────────────────────────
  router.post("/admin/products/bulk-delete", catalogueRoles, async (request, response) => {
    const ids = ((request.body?.productIds || []) as string[]).filter(Boolean);
    if (!ids.length) {
      throw new HttpError(400, "NO_IDS", "No product IDs provided for deletion.");
    }
    const [products, variants] = await Promise.all([
      ProductModel.deleteMany({ _id: { $in: ids } }),
      ProductVariantModel.deleteMany({ productId: { $in: ids } }),
    ]);
    response.json({
      success: true,
      data: { deletedProducts: products.deletedCount, deletedVariants: variants.deletedCount },
    });
  });

  // ── Quick generate / update S-2XL variants for a product ───────────────────
  router.post("/admin/products/:id/quick-variants", catalogueRoles, async (request, response) => {
    const productId = parameter(request, "id");
    const body = request.body as Record<string, unknown>;
    const priceSMPaise = Math.round((Number(body.priceSM) || 549) * 100);
    const priceLXLPaise = Math.round((Number(body.priceLXL) || 599) * 100);
    const priceXXLPaise = Math.round((Number(body.priceXXL) || 649) * 100);
    const mrpPaise = Math.round((Number(body.mrp) || 899) * 100);
    const stockOnHand = Math.max(1, Number(body.stock) || 25);

    const sizes = [
      { size: "S", price: priceSMPaise },
      { size: "M", price: priceSMPaise },
      { size: "L", price: priceLXLPaise },
      { size: "XL", price: priceLXLPaise },
      { size: "2XL", price: priceXXLPaise },
    ];

    for (const item of sizes) {
      const discountPct = mrpPaise > 0 ? Math.round(((mrpPaise - item.price) / mrpPaise) * 100) : 0;
      await ProductVariantModel.findOneAndUpdate(
        { productId, size: item.size, colour: "Standard" },
        {
          $set: {
            productId,
            size: item.size,
            colour: "Standard",
            colourHex: "#000000",
            salePricePaise: item.price,
            mrpPaise,
            discountPercent: discountPct,
            stockOnHand,
            status: "active",
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
    }

    await ProductModel.updateOne(
      { _id: productId },
      { $set: { status: "active" } },
    );

    response.json({ success: true, data: { updated: true } });
  });

  router.post(
    "/admin/products/bulk",
    catalogueRoles,
    validateBody(bulkProductUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.bulkUpdate(
          request.body.productIds,
          {
            ...(request.body.status ? { status: request.body.status } : {}),
            ...(request.body.categoryIds ? { categoryIds: request.body.categoryIds } : {}),
          },
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/products",
    catalogueRoles,
    validateBody(productWriteSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.create(request.body, request.auth!.userId, context(request)),
      }),
  );
  router.get("/admin/products/:id", catalogueRoles, async (request, response) =>
    response.json({ success: true, data: await service.adminDetail(parameter(request, "id")) }),
  );
  router.patch(
    "/admin/products/:id",
    catalogueRoles,
    validateBody(productPatchSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.update(
          parameter(request, "id"),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post("/admin/products/:id/archive", catalogueRoles, async (request, response) =>
    response.json({
      success: true,
      data: await service.archive(parameter(request, "id"), request.auth!.userId, context(request)),
    }),
  );
  router.post("/admin/products/:id/restore", catalogueRoles, async (request, response) =>
    response.json({
      success: true,
      data: await service.restore(parameter(request, "id"), request.auth!.userId, context(request)),
    }),
  );
  router.put(
    "/admin/products/:id/variants/matrix",
    catalogueRoles,
    validateBody(variantMatrixSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.replaceVariants(
          parameter(request, "id"),
          request.body.variants,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post("/admin/products/:id/preview-token", catalogueRoles, async (request, response) =>
    response.json({
      success: true,
      data: await service.previewToken(
        parameter(request, "id"),
        request.auth!.userId,
        context(request),
      ),
    }),
  );
  router.post(
    "/admin/products/:id/media",
    catalogueRoles,
    validateBody(mediaAttachSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.attachMedia(
          parameter(request, "id"),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.put(
    "/admin/products/:id/media/order",
    catalogueRoles,
    validateBody(mediaReorderSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.reorderMedia(
          parameter(request, "id"),
          request.body.orderedPublicIds,
          request.body.primaryPublicId,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post(
    "/admin/products/:id/media/delete",
    catalogueRoles,
    validateBody(mediaDeleteSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.removeMedia(
          parameter(request, "id"),
          request.body.publicId,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.post("/admin/media/upload-signature", catalogueRoles, async (request, response) =>
    response.json({
      success: true,
      data: await service.signedUpload(request.auth!.userId, context(request)),
    }),
  );
  router.post(
    "/admin/variants/:variantId/inventory-adjustments",
    ...stateChangeSecurity,
    inventoryRoles,
    validateBody(inventoryAdjustmentSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.adjustInventory(
          parameter(request, "variantId"),
          request.body.quantityDelta,
          request.body.reason,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  return router;
}
