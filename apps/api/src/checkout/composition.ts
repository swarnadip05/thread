import type { RequestHandler, Router } from "express";
import type { Logger } from "pino";

import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import type { ApiConfig } from "../config/env.js";
import { CheckoutService } from "./checkout.service.js";
import { createCheckoutRouter } from "./http/checkout.router.js";
import { MongooseCheckoutRepository } from "./repositories/mongoose-checkout.repository.js";
import { PaymentService } from "../payments/payment.service.js";
import {
  createPaymentRouter,
  createPaymentWebhookRouter,
} from "../payments/http/payment.router.js";
import { MongoosePaymentRepository } from "../payments/repositories/mongoose-payment.repository.js";
import { MockPaymentProvider } from "../payments/providers/mock-payment.provider.js";
import { RazorpayPaymentProvider } from "../payments/providers/razorpay-payment.provider.js";
import type { CommerceJobQueue } from "../notifications/jobs/commerce-job.queue.js";
import type { CommerceJobProcessor } from "../notifications/jobs/commerce-job.processor.js";
import type { NotificationService } from "../notifications/notification.service.js";

export interface CheckoutComposition {
  readonly router: Router;
  readonly paymentRouter: Router;
  readonly paymentWebhookRouter: Router;
  readonly paymentService: PaymentService;
  readonly checkoutService: CheckoutService;
  startJobProducer(): Promise<void>;
  startJobWorker(): Promise<void>;
  closeJobs(): Promise<void>;
}

export function composeCheckout(
  config: ApiConfig,
  authenticate: RequestHandler,
  logger: Logger,
  jobs: CommerceJobQueue,
  jobProcessor: CommerceJobProcessor,
  notifications: NotificationService,
): CheckoutComposition {
  const repository = new MongooseCheckoutRepository(config.maxCartQuantity);
  const audits = new MongooseAuditRepository();
  const service = new CheckoutService(repository, jobs, audits, notifications);
  const provider =
    config.paymentProvider === "razorpay" && config.razorpay
      ? new RazorpayPaymentProvider(
          config.razorpay.keyId,
          config.razorpay.keySecret,
          config.razorpay.webhookSecret,
        )
      : new MockPaymentProvider();
  const paymentService = new PaymentService(
    provider,
    new MongoosePaymentRepository(),
    repository,
    audits,
    notifications,
  );
  return {
    router: createCheckoutRouter(service, authenticate, config.webOrigin),
    paymentRouter: createPaymentRouter(paymentService, authenticate, config.webOrigin),
    paymentWebhookRouter: createPaymentWebhookRouter(paymentService),
    paymentService,
    checkoutService: service,
    startJobProducer: () => jobs.startProducer(),
    startJobWorker: () =>
      jobs.startWorker(async (job) => {
        if (job.name === "reservation.release") {
          await service.expire(job.payload.sessionId);
          return;
        }
        await jobProcessor.process(job);
      }),
    closeJobs: () => jobs.close(),
  };
}
