import { Router, type Request, type RequestHandler } from "express";
import { homepageDraftUpdateSchema, newsletterSubscribeSchema } from "@thread/validation";

import type { AuthContext } from "../auth/auth.types.js";
import { authRateLimit, requireRoles, validateBody } from "../auth/http/security.middleware.js";
import type { HomepageService } from "./homepage.service.js";

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

export function createHomepageRouter(
  service: HomepageService,
  authenticateAdmin: RequestHandler,
): Router {
  const router = Router();

  router.get("/public/homepage", async (_request, response) => {
    response
      .set("cache-control", "public, max-age=60, stale-while-revalidate=300")
      .json({ success: true, data: await service.publicHomepage() });
  });
  router.get("/public/homepage/preview/:token", async (request, response) =>
    response
      .set("cache-control", "private, no-store")
      .json({ success: true, data: await service.preview(parameter(request, "token")) }),
  );
  router.post(
    "/public/newsletter",
    authRateLimit(5, 60 * 60 * 1_000),
    validateBody(newsletterSubscribeSchema),
    async (request, response) =>
      response.status(201).json({
        success: true,
        data: await service.subscribe(request.body.email),
      }),
  );

  router.use(
    "/admin/homepage",
    authenticateAdmin,
    requireRoles("super_admin", "admin", "catalog_manager"),
  );
  router.get("/admin/homepage", async (_request, response) =>
    response.json({ success: true, data: await service.adminHomepage() }),
  );
  router.get("/admin/homepage/options", async (_request, response) =>
    response.json({ success: true, data: { collections: await service.collectionOptions() } }),
  );
  router.put(
    "/admin/homepage/draft",
    validateBody(homepageDraftUpdateSchema),
    async (request, response) =>
      response.json({
        success: true,
        data: await service.updateDraft(request.body, request.auth!.userId, context(request)),
      }),
  );
  router.post("/admin/homepage/publish", async (request, response) =>
    response.json({
      success: true,
      data: await service.publish(request.auth!.userId, context(request)),
    }),
  );
  router.post("/admin/homepage/preview-token", async (request, response) =>
    response.json({
      success: true,
      data: await service.previewToken(request.auth!.userId, context(request)),
    }),
  );
  router.post("/admin/homepage/media/upload-signature", async (request, response) =>
    response.json({
      success: true,
      data: await service.uploadSignature(request.auth!.userId, context(request)),
    }),
  );
  return router;
}
