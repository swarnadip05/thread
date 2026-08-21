import type { RequestHandler, Router } from "express";

import { MongooseAuditRepository } from "../auth/repositories/audit.repository.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { PaymentService } from "../payments/payment.service.js";
import { OperationsRepository } from "./operations.repository.js";
import { createOperationsRouter } from "./operations.router.js";
import { OperationsService } from "./operations.service.js";

export function composeOperations(
  authenticate: RequestHandler,
  webOrigin: string,
  payments: PaymentService,
  notifications: NotificationService,
): Router {
  const service = new OperationsService(
    new OperationsRepository(),
    new MongooseAuditRepository(),
    payments,
    notifications,
  );
  return createOperationsRouter(service, authenticate, webOrigin);
}
