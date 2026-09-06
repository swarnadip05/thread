import "dotenv/config";
import pino from "pino";
import { connectDatabase, disconnectDatabase } from "../../database/connection.js";
import { bootstrapAdmin, parseBootstrapEnvironment } from "../bootstrap-admin.js";

const logger = pino({ redact: ["password", "ADMIN_BOOTSTRAP_PASSWORD"] });
async function run(): Promise<void> {
  const input = parseBootstrapEnvironment(process.env);
  try {
    await connectDatabase(process.env.MONGODB_URI!, logger);
    const result = await bootstrapAdmin(input);
    logger.info(
      result === "created"
        ? "Super administrator created. Sign in at /admin/login and change the bootstrap password."
        : "Super administrator already exists. No credentials or roles changed.",
    );
  } finally {
    await disconnectDatabase(logger);
  }
}
run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Admin bootstrap failed."}\n`);
  process.exitCode = 1;
});
