import "dotenv/config";

import pino from "pino";

import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { runDemoSeed, isValidDemoSeedConfirmation } from "./demo-catalogue.js";
import { runSeedMigrations } from "./migrations.js";

async function run(): Promise<void> {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled when NODE_ENV=production.");
  if (!isValidDemoSeedConfirmation(process.env.DEMO_SEED_CONFIRM))
    throw new Error("Set DEMO_SEED_CONFIRM=SEED_THREAD_DEMO to seed local demonstration data.");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  const logger = pino();
  try {
    await connectDatabase(uri, logger);
    await runSeedMigrations();
    const result = await runDemoSeed();
    logger.info({ result }, "THREAD local demo seed completed; no administrator was created");
  } finally {
    await disconnectDatabase(logger);
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Demo seed failed."}\n`);
  process.exitCode = 1;
});
