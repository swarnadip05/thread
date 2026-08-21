import "dotenv/config";

import pino from "pino";

import { connectDatabase, disconnectDatabase } from "../../database/connection.js";
import { MongooseUserRepository } from "../repositories/user.repository.js";
import { hashPassword } from "../security/password.js";

const CONFIRMATION = "CREATE_THREAD_SUPER_ADMIN";

async function run(): Promise<void> {
  const {
    ADMIN_BOOTSTRAP_CONFIRM,
    ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_NAME,
    ADMIN_BOOTSTRAP_PASSWORD,
    MONGODB_URI,
  } = process.env;
  if (ADMIN_BOOTSTRAP_CONFIRM !== CONFIRMATION)
    throw new Error(`Set ADMIN_BOOTSTRAP_CONFIRM=${CONFIRMATION} for this one-time operation.`);
  if (!MONGODB_URI || !ADMIN_BOOTSTRAP_EMAIL || !ADMIN_BOOTSTRAP_NAME || !ADMIN_BOOTSTRAP_PASSWORD)
    throw new Error("MONGODB_URI and all ADMIN_BOOTSTRAP_* values are required.");
  if (ADMIN_BOOTSTRAP_PASSWORD.length < 14)
    throw new Error("The bootstrap password must contain at least 14 characters.");

  const logger = pino({ redact: ["password", "ADMIN_BOOTSTRAP_PASSWORD"] });
  await connectDatabase(MONGODB_URI, logger);
  const users = new MongooseUserRepository();
  if (await users.hasSuperAdmin())
    throw new Error("A super administrator already exists; bootstrap is one-time only.");
  const user = await users.create({
    name: ADMIN_BOOTSTRAP_NAME,
    email: ADMIN_BOOTSTRAP_EMAIL.toLowerCase(),
    passwordHash: await hashPassword(ADMIN_BOOTSTRAP_PASSWORD),
    roles: ["super_admin"],
    mustChangePassword: true,
  });
  logger.info(
    { userId: user.id },
    "Super administrator created; password change is required on first login",
  );
  await disconnectDatabase(logger);
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Admin bootstrap failed."}\n`);
  process.exitCode = 1;
});
