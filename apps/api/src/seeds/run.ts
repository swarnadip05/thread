import "dotenv/config";
import pino from "pino";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { runSeedMigrations } from "./migrations.js";

const logger = pino();
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required.");
  try {
    await connectDatabase(uri, logger);
    await runSeedMigrations();
    logger.info("Seed migrations are up to date");
  } finally {
    await disconnectDatabase(logger);
  }
}
run().catch((error: unknown) => {
  logger.error({ err: error }, "Seed migration failed");
  process.exitCode = 1;
});
