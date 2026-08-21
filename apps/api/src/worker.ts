import { createServer } from "node:http";

import "dotenv/config";

import { composeAuth } from "./auth/composition.js";
import { composeCheckout } from "./checkout/composition.js";
import { loadApiConfig } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { createLogger } from "./lib/logger.js";
import {
  composeNotifications,
  createCommerceJobQueue,
  createQueuedAuthEmailProvider,
} from "./notifications/composition.js";

const config = loadApiConfig();
const logger = createLogger({ level: config.logLevel, nodeEnv: config.nodeEnv });
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

// The unbound Socket.IO server publishes worker-originated events through the
// Redis adapter without exposing an additional HTTP port.
const realtimePublisherServer = createServer();
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Worker graceful shutdown started");
  const forceShutdownTimer = setTimeout(() => {
    logger.error("Worker graceful shutdown timed out");
    process.exitCode = 1;
  }, 10_000);
  forceShutdownTimer.unref();
  try {
    await checkoutComposition.closeJobs();
    await notificationComposition.realtime.close();
    await disconnectDatabase(logger);
    logger.info("Worker graceful shutdown completed");
  } catch (error) {
    logger.error({ err: error }, "Worker failed to shut down cleanly");
    process.exitCode = 1;
  } finally {
    clearTimeout(forceShutdownTimer);
  }
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));

async function start(): Promise<void> {
  try {
    await connectDatabase(config.mongodbUri, logger);
    await notificationComposition.realtime.attach(realtimePublisherServer);
    await checkoutComposition.startJobWorker();
    logger.info("THREAD background worker started");
  } catch (error) {
    logger.fatal({ err: error }, "Worker startup failed");
    process.exitCode = 1;
    await shutdown("SIGTERM");
  }
}

void start();
