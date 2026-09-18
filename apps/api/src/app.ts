import cors from "cors";
import compression from "compression";
import express, { type Express, type Request, type Response, type Router } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";

import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { rejectPrototypePollution, requireJsonContentType } from "./middleware/request-security.js";
import { HttpError } from "./middleware/error-handler.js";

export interface AppDependencies {
  readonly isReady: () => boolean;
  readonly dependencyStatus?: () => Promise<Readonly<Record<string, boolean>>>;
  readonly healthDetails?: () => Promise<{
    readonly mongodb: boolean;
    readonly redis: boolean;
    readonly database?: string;
  }>;
  readonly maintenanceMode?: () => Promise<boolean>;
  readonly logger: Logger;
  readonly authRouter?: Router;
  readonly contentRouter?: Router;
  readonly catalogueRouter?: Router;
  readonly checkoutRouter?: Router;
  readonly paymentRouter?: Router;
  readonly paymentWebhookRouter?: Router;
  readonly homepageRouter?: Router;
  readonly notificationRouter?: Router;
  readonly adminDashboardRouter?: Router;
  readonly operationsRouter?: Router;
  readonly webOrigin: string;
  readonly corsOrigins?: readonly string[];
  readonly trustProxyHops?: number;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", dependencies.trustProxyHops ?? 0);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(compression({ threshold: 1_024 }));
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp<Request, Response>({
      logger: dependencies.logger,
      genReqId: (request) => request.requestId,
      customProps: (request) => ({
        requestId: request.requestId,
        ...(request.auth?.userId ? { userId: request.auth.userId } : {}),
      }),
    }),
  );
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        const allowed = new Set(dependencies.corsOrigins ?? [dependencies.webOrigin]);
        const normalized = origin?.replace(/\/+$/, "");
        if (!normalized) return callback(null, true);
        if (allowed.has(normalized)) return callback(null, true);

        try {
          const originHost = new URL(normalized).hostname;
          for (const a of allowed) {
            const allowedHost = new URL(a).hostname;
            if (
              originHost === allowedHost ||
              originHost === `www.${allowedHost}` ||
              `www.${originHost}` === allowedHost
            ) {
              return callback(null, true);
            }
          }
        } catch {
          // ignore url parse error
        }

        if (normalized.endsWith(".vercel.app")) {
          return callback(null, true);
        }

        callback(new HttpError(403, "CORS_ORIGIN_REJECTED", "Request origin was rejected."));
      },
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Idempotency-Key",
        "X-CSRF-Token",
        "X-Request-Id",
      ],
      maxAge: 600,
    }),
  );
  if (dependencies.paymentWebhookRouter) app.use("/api/v1", dependencies.paymentWebhookRouter);
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (request) => request.path.startsWith("/health/") || request.path === "/api/v1/health",
    }),
  );
  app.use(rejectPrototypePollution);
  app.use(requireJsonContentType);
  app.use(express.json({ limit: "50mb", strict: true }));

  app.get("/api/v1/health", async (request, response) => {
    const details = dependencies.healthDetails
      ? await dependencies.healthDetails()
      : {
          mongodb: dependencies.isReady(),
          redis: false,
        };
    const apiReady = dependencies.isReady();
    const ready = apiReady && details.mongodb && details.redis;
    response.status(ready ? 200 : 503).json({
      success: true,
      data: {
        api: apiReady ? "ok" : "unavailable",
        mongodb: details.mongodb ? "connected" : "unavailable",
        redis: details.redis ? "connected" : "unavailable",
        database: details.database ?? "unavailable",
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
      },
    });
  });

  const maintenanceMode = dependencies.maintenanceMode;
  if (maintenanceMode)
    app.use("/api/v1", async (request, _response, next) => {
      if (
        request.path.startsWith("/admin/") ||
        request.path.startsWith("/auth/") ||
        request.path.startsWith("/payments/webhooks/")
      )
        return next();
      if (await maintenanceMode())
        return next(
          new HttpError(
            503,
            "MAINTENANCE_MODE",
            "THREAD is temporarily unavailable for scheduled maintenance.",
          ),
        );
      next();
    });

  if (dependencies.authRouter) app.use("/api/v1/auth", dependencies.authRouter);
  if (dependencies.contentRouter) app.use("/api/v1", dependencies.contentRouter);
  if (dependencies.catalogueRouter) app.use("/api/v1", dependencies.catalogueRouter);
  if (dependencies.checkoutRouter) app.use("/api/v1", dependencies.checkoutRouter);
  if (dependencies.paymentRouter) app.use("/api/v1", dependencies.paymentRouter);
  if (dependencies.homepageRouter) app.use("/api/v1", dependencies.homepageRouter);
  if (dependencies.notificationRouter) app.use("/api/v1", dependencies.notificationRouter);
  if (dependencies.adminDashboardRouter) app.use("/api/v1", dependencies.adminDashboardRouter);
  if (dependencies.operationsRouter) app.use("/api/v1", dependencies.operationsRouter);

  app.get("/health/live", (request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: "live",
        service: "thread-api",
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
      },
    });
  });

  app.get("/health/ready", async (request, response) => {
    const dependencyStatus = dependencies.dependencyStatus
      ? await dependencies.dependencyStatus()
      : { database: dependencies.isReady() };
    const ready = dependencies.isReady() && Object.values(dependencyStatus).every(Boolean);
    response.status(ready ? 200 : 503).json({
      success: true,
      data: {
        status: ready ? "ready" : "not-ready",
        service: "thread-api",
        timestamp: new Date().toISOString(),
        requestId: request.requestId,
        dependencies: Object.fromEntries(
          Object.entries(dependencyStatus).map(([name, healthy]) => [
            name,
            healthy ? "up" : "down",
          ]),
        ),
      },
    });
  });

  app.use(notFoundHandler);
  app.use(createErrorHandler(dependencies.logger));

  return app;
}
