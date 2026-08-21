import type { Logger } from "pino";
import type { Router, RequestHandler } from "express";

import type { AccessTokenService } from "../auth/security/tokens.js";
import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import type { ApiConfig } from "../config/env.js";
import { RealtimeGateway } from "../realtime/realtime.gateway.js";
import { CommerceJobQueue } from "./jobs/commerce-job.queue.js";
import { CommerceJobProcessor } from "./jobs/commerce-job.processor.js";
import { MongooseNotificationRepository } from "./notification.repository.js";
import { createNotificationRouter } from "./notification.router.js";
import { NotificationService, QueuedAuthEmailProvider } from "./notification.service.js";
import { PdfInvoiceProvider } from "./providers/invoice.provider.js";
import {
  LocalLogEmailProvider,
  SmtpEmailProvider,
} from "./providers/transactional-email.provider.js";

export interface NotificationComposition {
  readonly jobs: CommerceJobQueue;
  readonly processor: CommerceJobProcessor;
  readonly realtime: RealtimeGateway;
  readonly router: Router;
  readonly service: NotificationService;
}

export function createCommerceJobQueue(config: ApiConfig, logger: Logger): CommerceJobQueue {
  return new CommerceJobQueue(config.redisUrl, logger);
}

export function createQueuedAuthEmailProvider(jobs: CommerceJobQueue): QueuedAuthEmailProvider {
  return new QueuedAuthEmailProvider(jobs);
}

export function composeNotifications(
  config: ApiConfig,
  accessTokens: AccessTokenService,
  authenticate: RequestHandler,
  jobs: CommerceJobQueue,
  logger: Logger,
): NotificationComposition {
  const repository = new MongooseNotificationRepository();
  const realtime = new RealtimeGateway(accessTokens, logger, {
    webOrigin: config.webOrigin,
    redisUrl: config.redisUrl,
    redisAdapterEnabled: config.socketRedisAdapterEnabled,
  });
  const email =
    config.email.provider === "smtp"
      ? new SmtpEmailProvider(config.email)
      : new LocalLogEmailProvider(logger);
  const service = new NotificationService(
    repository,
    jobs,
    realtime,
    new MongooseAuditRepository(),
  );
  return {
    jobs,
    processor: new CommerceJobProcessor(
      email,
      new PdfInvoiceProvider(),
      repository,
      realtime,
      logger,
    ),
    realtime,
    router: createNotificationRouter(service, authenticate, config.webOrigin),
    service,
  };
}
