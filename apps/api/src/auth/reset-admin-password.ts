import mongoose from "mongoose";
import { registerSchema } from "@thread/validation";

import { AuditLogModel } from "../models/audit-log.model.js";
import { AuthSessionModel } from "../models/auth-session.model.js";
import { UserModel } from "../models/user.model.js";
import { hashPassword } from "./security/password.js";

const confirmation = "RESET_THREAD_ADMIN_PASSWORD";

export interface AdminPasswordResetInput {
  readonly email: string;
  readonly password: string;
}

export function parseAdminPasswordResetEnvironment(
  environment: NodeJS.ProcessEnv,
): AdminPasswordResetInput {
  if (environment.NODE_ENV === "production")
    throw new Error("Admin password reset is disabled in production.");
  if (environment.NODE_ENV !== "development")
    throw new Error("Admin password reset requires NODE_ENV=development.");
  if (environment.ADMIN_RESET_CONFIRM !== confirmation)
    throw new Error(`Set ADMIN_RESET_CONFIRM=${confirmation} to run the reset.`);
  if (!environment.MONGODB_URI) throw new Error("MONGODB_URI is required.");

  const result = registerSchema.pick({ email: true, password: true }).safeParse({
    email: environment.ADMIN_RESET_EMAIL,
    password: environment.ADMIN_RESET_PASSWORD,
  });
  if (!result.success)
    throw new Error(
      `Invalid ADMIN_RESET_* values: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  return result.data;
}

export async function resetAdminPassword(
  input: AdminPasswordResetInput,
): Promise<{ readonly revokedSessions: number }> {
  const passwordHash = await hashPassword(input.password);

  return mongoose.connection.transaction(async (session) => {
    const user = await UserModel.findOne({ email: input.email }).session(session).exec();
    if (!user) throw new Error("No account exists for ADMIN_RESET_EMAIL.");
    if (!user.roles.some((role) => role === "admin" || role === "super_admin"))
      throw new Error("ADMIN_RESET_EMAIL does not belong to an admin or super_admin account.");

    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          mustChangePassword: false,
          "loginSecurity.failedAttempts": 0,
        },
        $unset: {
          "loginSecurity.backoffUntil": 1,
          "loginSecurity.lastFailedAt": 1,
        },
      },
      { session },
    ).exec();

    const revoked = await AuthSessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: "admin-password-reset" } },
      { session },
    ).exec();

    await AuditLogModel.create(
      [
        {
          action: "auth.admin_password_reset",
          entity: "user",
          entityId: user._id.toString(),
          metadata: {
            source: "development-cli",
            refreshSessionsRevoked: revoked.modifiedCount,
          },
          timestamp: new Date(),
        },
      ],
      { session },
    );

    return { revokedSessions: revoked.modifiedCount };
  });
}
