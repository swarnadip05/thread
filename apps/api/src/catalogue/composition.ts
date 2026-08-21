import type { ApiConfig } from "../config/env.js";
import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import type { RequestHandler, Router } from "express";
import { CatalogueService } from "./catalogue.service.js";
import { createCatalogueRouter } from "./http/catalogue.router.js";
import { CloudinaryMediaProvider, UnconfiguredMediaProvider } from "./media/cloudinary.provider.js";
import { MongooseCatalogueRepository } from "./repositories/mongoose-catalogue.repository.js";
import { ProductPreviewTokenService } from "./security/preview-token.js";
import { RulesBasedDeliveryProvider } from "./delivery/delivery.provider.js";
import { MongooseReviewRepository } from "./reviews/review.repository.js";
import { MongoosePurchaseVerificationProvider, ReviewService } from "./reviews/review.service.js";
import type { CommerceJobQueue } from "../notifications/jobs/commerce-job.queue.js";

export function composeCatalogue(
  config: ApiConfig,
  authenticateAdmin: RequestHandler,
  jobs?: CommerceJobQueue,
): Router {
  const media = config.cloudinary
    ? new CloudinaryMediaProvider(config.cloudinary)
    : new UnconfiguredMediaProvider();
  const audits = new MongooseAuditRepository();
  const service = new CatalogueService(
    new MongooseCatalogueRepository(),
    audits,
    media,
    new ProductPreviewTokenService(config.productPreviewSecret),
    jobs,
  );
  return createCatalogueRouter(
    service,
    new ReviewService(
      new MongooseReviewRepository(),
      new MongoosePurchaseVerificationProvider(),
      audits,
    ),
    new RulesBasedDeliveryProvider(config.deliveryPostalPrefixes),
    authenticateAdmin,
    {
      maxCartQuantity: config.maxCartQuantity,
      webOrigin: config.webOrigin,
    },
  );
}
