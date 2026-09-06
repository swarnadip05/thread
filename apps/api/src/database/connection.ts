import mongoose from "mongoose";
import type { Logger } from "pino";

export type DatabaseState = "disconnected" | "connecting" | "connected" | "disconnecting";

export function getDatabaseState(): DatabaseState {
  const states: Record<number, DatabaseState> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] ?? "disconnected";
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDatabase(uri: string, logger: Logger): Promise<void> {
  mongoose.set("strictQuery", true);
  // Repositories construct filters from validated scalar inputs. Global sanitizeFilter
  // rewrites our own $in/$exists/$lte operators as literal values, breaking seeds,
  // session rotation and catalogue queries. Never pass raw request objects to Mongoose.
  mongoose.set("sanitizeFilter", false);

  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("error", (error) =>
    logger.error({ err: error }, "MongoDB connection error"),
  );

  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== "production",
    maxPoolSize: 20,
    minPoolSize: process.env.NODE_ENV === "production" ? 2 : 0,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ database: mongoose.connection.name }, "MongoDB connected");
}

export async function checkDatabaseHealth(): Promise<boolean> {
  if (!isDatabaseReady() || !mongoose.connection.db) return false;
  try {
    const result = await mongoose.connection.db.admin().ping();
    return result.ok === 1;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(logger: Logger): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info("MongoDB connection closed");
}
