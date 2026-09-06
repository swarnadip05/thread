import { Router, type RequestHandler } from "express";

import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import { createCollectionsRouter } from "./collections.router.js";
import { ContentService } from "./content.service.js";
import { createContentRouter } from "./content.router.js";
import { MongooseCategoryRepository } from "./repositories/category.repository.js";
import { MongooseContentPageRepository } from "./repositories/content-page.repository.js";
import { MongooseSiteSettingsRepository } from "./repositories/site-settings.repository.js";

export function composeContent(authenticateAdmin: RequestHandler): Router {
  const service = new ContentService(
    new MongooseCategoryRepository(),
    new MongooseSiteSettingsRepository(),
    new MongooseContentPageRepository(),
    new MongooseAuditRepository(),
  );
  return Router()
    .use(createContentRouter(service, authenticateAdmin))
    .use(createCollectionsRouter(authenticateAdmin, new MongooseAuditRepository()));
}
