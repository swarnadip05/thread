import "dotenv/config";

import pino from "pino";

import { connectDatabase, disconnectDatabase } from "../../database/connection.js";
import {
  parseAdminPasswordResetEnvironment,
  resetAdminPassword,
} from "../reset-admin-password.js";

const logger = pino({ redact: ["password", "ADMIN_RESET_PASSWORD"] });

async function run(): Promise<void> {
  const input = parseAdminPasswordResetEnvironment(process.env);
  try {
    await connectDatabase(process.env.MONGODB_URI!, logger);
    const result = await resetAdminPassword(input);
    logger.info(
      { revokedSessions: result.revokedSessions },
      "Administrator password reset and existing refresh sessions revoked",
    );
  } finally {
    await disconnectDatabase(logger);
  }
}

run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Administrator password reset failed."}\n`,
  );
  process.exitCode = 1;
});
