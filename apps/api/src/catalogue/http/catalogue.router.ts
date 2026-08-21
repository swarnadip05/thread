import { Router, type Request, type RequestHandler, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import type { ZodType } from "@thread/validation";
import {
  bulkProductUpdateSchema,
  catalogueQuerySchema,
  csvImportPreviewSchema,
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
import type { CatalogueService } from "../catalogue.service.js";
import type { DeliveryEligibilityProvider } from "../delivery/delivery.provider.js";
import type { ReviewService } from "../reviews/review.service.js";

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
): Router;
export function createCatalogueRouter(
  service: CatalogueService,
  reviewsOrAuthentication: ReviewService | RequestHandler,
  deliveryProvider?: DeliveryEligibilityProvider,
  authentication?: RequestHandler,
  configuredOptions?: { maxCartQuantity: number; webOrigin: string },
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
    response.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
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
    validateBody(csvImportPreviewSchema),
    (request, response) =>
      response.json({ success: true, data: service.previewCsv(request.body.csv) }),
  );
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
