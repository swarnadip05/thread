import type { RequestHandler, Router } from "express";

import type { ApiConfig } from "../config/env.js";
import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import {
  CloudinaryMediaProvider,
  UnconfiguredMediaProvider,
} from "../catalogue/media/cloudinary.provider.js";
import { HomepagePreviewTokenService } from "./homepage-preview-token.js";
import { MongooseHomepageRepository } from "./homepage.repository.js";
import { createHomepageRouter } from "./homepage.router.js";
import { HomepageService } from "./homepage.service.js";
import type { NotificationService } from "../notifications/notification.service.js";

export function composeHomepage(
  config: ApiConfig,
  authenticateAdmin: RequestHandler,
  notifications?: NotificationService,
): Router {
  const media = config.cloudinary
    ? new CloudinaryMediaProvider(config.cloudinary)
    : new UnconfiguredMediaProvider();
  const service = new HomepageService(
    new MongooseHomepageRepository(),
    new MongooseAuditRepository(),
    media,
    new HomepagePreviewTokenService(config.productPreviewSecret),
    notifications,
  );
  return createHomepageRouter(service, authenticateAdmin);
}
