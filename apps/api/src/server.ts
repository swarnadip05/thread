import { createServer } from "node:http";

import "dotenv/config";

import { createApp } from "./app.js";
import { composeAuth } from "./auth/composition.js";
import { composeAdminDashboard } from "./admin/composition.js";
import { loadApiConfig } from "./config/env.js";
import { composeCatalogue } from "./catalogue/composition.js";
import { composeContent } from "./content/composition.js";
import { composeHomepage } from "./homepage/composition.js";
import { composeCheckout } from "./checkout/composition.js";
import {
  checkDatabaseHealth,
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
} from "./database/connection.js";
import { createLogger } from "./lib/logger.js";
import {
  composeNotifications,
  createCommerceJobQueue,
  createQueuedAuthEmailProvider,
} from "./notifications/composition.js";
import { composeOperations } from "./operations/composition.js";
import { LogAndWebhookAlertingHook } from "./reliability/alerting.js";
import { ReliabilityReconciliationService } from "./reliability/reconciliation.service.js";
import { SiteSettingsModel } from "./models/site-settings.model.js";

const config = loadApiConfig();
const logger = createLogger({ level: config.logLevel, nodeEnv: config.nodeEnv });
let isReady = false;
let maintenanceCache: { expiresAt: number; value: boolean } | undefined;

const jobs = createCommerceJobQueue(config, logger);
const authComposition = composeAuth(config, logger, createQueuedAuthEmailProvider(jobs));
const notificationComposition = composeNotifications(
  config,
  authComposition.accessTokens,
  authComposition.authenticate,
  jobs,
  logger,
);
const checkoutComposition = composeCheckout(
  config,
  authComposition.authenticate,
  logger,
  jobs,
  notificationComposition.processor,
  notificationComposition.service,
);
const reliability = new ReliabilityReconciliationService(
  checkoutComposition.checkoutService,
  checkoutComposition.paymentService,
  new LogAndWebhookAlertingHook(logger, config.alertWebhookUrl),
  logger,
  config.piiRetentionDays,
);
const app = createApp({
  authRouter: authComposition.router,
  catalogueRouter: composeCatalogue(config, authComposition.authenticate, jobs),
  contentRouter: composeContent(authComposition.authenticate),
  checkoutRouter: checkoutComposition.router,
  paymentRouter: checkoutComposition.paymentRouter,
  paymentWebhookRouter: checkoutComposition.paymentWebhookRouter,
  homepageRouter: composeHomepage(
    config,
    authComposition.authenticate,
    notificationComposition.service,
  ),
  notificationRouter: notificationComposition.router,
  adminDashboardRouter: composeAdminDashboard(authComposition.authenticate),
  operationsRouter: composeOperations(
    authComposition.authenticate,
    config.webOrigin,
    checkoutComposition.paymentService,
    notificationComposition.service,
  ),
  isReady: () => isReady && isDatabaseReady(),
  dependencyStatus: async () => ({
    database: await checkDatabaseHealth(),
    queue: await jobs.isReady(),
  }),
  maintenanceMode: async () => {
    if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) return maintenanceCache.value;
    const settings = await SiteSettingsModel.findOne({ key: "default" })
      .select("maintenanceMode")
      .lean();
    maintenanceCache = {
      expiresAt: Date.now() + 15_000,
      value: settings?.maintenanceMode ?? false,
    };
    return maintenanceCache.value;
  },
  logger,
  webOrigin: config.webOrigin,
  corsOrigins: config.corsOrigins,
  trustProxyHops: config.trustProxyHops,
});
const server = createServer(app);

server.on("error", (error) => {
  logger.fatal({ err: error }, "API server failed");
  process.exitCode = 1;
});

function shutdown(signal: NodeJS.Signals): void {
  isReady = false;
  logger.info({ signal }, "Graceful shutdown started");

  const forceShutdownTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out; closing active connections");
    server.closeAllConnections();
    process.exitCode = 1;
  }, 10_000);
  forceShutdownTimer.unref();

  void notificationComposition.realtime.close().finally(() =>
    server.close(async (error) => {
      clearTimeout(forceShutdownTimer);
      if (error) {
        logger.error({ err: error }, "HTTP server failed to close cleanly");
        process.exitCode = 1;
      } else {
        reliability.stop();
        await checkoutComposition.closeJobs();
        await disconnectDatabase(logger);
        logger.info("Graceful shutdown completed");
      }
    }),
  );
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

async function start(): Promise<void> {
  try {
    await connectDatabase(config.mongodbUri, logger);
    await checkoutComposition.startJobProducer();
    reliability.start();
    await notificationComposition.realtime.attach(server);
    server.listen(config.port, config.host, () => {
      isReady = true;
      logger.info({ host: config.host, port: config.port }, "THREAD API listening");
    });
  } catch (error) {
    logger.fatal({ err: error }, "API startup failed");
    process.exitCode = 1;
  }
}

void start();
