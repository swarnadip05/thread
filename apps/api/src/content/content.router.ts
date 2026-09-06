import { Router, type Request, type RequestHandler } from "express";
import {
  announcementUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  contentPageUpdateSchema,
  footerLinksUpdateSchema,
  navigationUpdateSchema,
  socialLinksUpdateSchema,
} from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import { requireRoles, validateBody } from "../auth/http/security.middleware.js";
import { HttpError } from "../middleware/error-handler.js";
import type { ContentService } from "./content.service.js";

function context(request: Request): AuthContext {
  const ip = request.ip;
  return {
    ...(ip ? { ip } : {}),
    requestId: request.requestId,
    ...(request.header("user-agent")
      ? { userAgent: request.header("user-agent")!.slice(0, 512) }
      : {}),
  };
}
function validSlug(value: string | string[]): string {
  const slug = Array.isArray(value) ? value[0] : value;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new HttpError(400, "INVALID_SLUG", "Content slug is invalid.");
  return slug;
}
function parameter(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function createContentRouter(
  service: ContentService,
  authenticateAdmin: RequestHandler,
): Router {
  const router = Router();
  router.get("/public/navigation", async (_request, response) => {
    response
      .set("cache-control", "public, max-age=60, stale-while-revalidate=300")
      .json({ success: true, data: await service.getPublicNavigation() });
  });
  router.get("/public/site-settings", async (_request, response) => {
    response
      .set("cache-control", "public, max-age=60, stale-while-revalidate=300")
      .json({ success: true, data: await service.getPublicSettings() });
  });
  router.get("/public/content/:slug", async (request, response) =>
    response.json({
      success: true,
      data: await service.getPage(validSlug(parameter(request, "slug"))),
    }),
  );

  router.use(
    ["/admin/categories", "/admin/navigation", "/admin/site-settings", "/admin/content"],
    authenticateAdmin,
    requireRoles("super_admin", "admin", "catalog_manager"),
  );
  router.get("/admin/categories", async (_request, response) =>
    response.json({ success: true, data: await service.listCategories() }),
  );
  router.post("/admin/categories", validateBody(categoryCreateSchema), async (request, response) =>
    response.status(201).json({
      success: true,
      data: await service.createCategory(request.body, request.auth!.userId, context(request)),
    }),
  );
  router.patch(
    "/admin/categories/:id",
    validateBody(categoryUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateCategory(
          parameter(request, "id"),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.delete("/admin/categories/:id", async (request, response) => {
    await service.removeCategory(parameter(request, "id"), request.auth!.userId, context(request));
    response.status(204).send();
  });
  router.put("/admin/navigation", validateBody(navigationUpdateSchema), async (request, response) =>
    response.json({
      success: true,
      data: await service.updateNavigation(request.body, request.auth!.userId, context(request)),
    }),
  );
  router.patch(
    "/admin/site-settings/announcement",
    validateBody(announcementUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateAnnouncement(
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.put(
    "/admin/site-settings/footer-links",
    validateBody(footerLinksUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateFooter(request.body, request.auth!.userId, context(request)),
      }),
  );
  router.put(
    "/admin/site-settings/social-links",
    validateBody(socialLinksUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateSocial(request.body, request.auth!.userId, context(request)),
      }),
  );
  router.get("/admin/content/pages", async (_request, response) =>
    response.json({ success: true, data: await service.listPages() }),
  );
  router.put(
    "/admin/content/pages/:slug",
    validateBody(contentPageUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updatePage(
          validSlug(parameter(request, "slug")),
          request.body,
          request.auth!.userId,
          context(request),
        ),
      }),
  );
  router.get("/admin/content/review-summary", async (_request, response) =>
    response.json({ success: true, data: await service.getReviewSummary() }),
  );
  return router;
}
