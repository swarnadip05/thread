import "dotenv/config";

import mongoose from "mongoose";
import pino from "pino";

import { connectDatabase, disconnectDatabase } from "../database/connection.js";

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.E2E_RESET_CONFIRM !== "RESET_THREAD_E2E" ||
    !uri ||
    new URL(uri.replace("mongodb://", "http://")).pathname !== "/thread_commerce_e2e"
  )
    throw new Error(
      "E2E reset requires NODE_ENV=test, the dedicated thread_commerce_e2e database and exact confirmation.",
    );
  const logger = pino();
  await connectDatabase(uri, logger);
  await mongoose.connection.dropDatabase();
  logger.info("Dedicated THREAD E2E database reset");
  await disconnectDatabase(logger);
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "E2E reset failed."}\n`);
  process.exitCode = 1;
});
