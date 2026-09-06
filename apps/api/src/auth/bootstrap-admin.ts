import mongoose from "mongoose";
import { registerSchema } from "@thread/validation";
import { UserModel } from "../models/user.model.js";
import { SeedMigrationModel } from "../models/seed-migration.model.js";
import { hashPassword } from "./security/password.js";

export function parseBootstrapEnvironment(environment: NodeJS.ProcessEnv) {
  if (environment.ADMIN_BOOTSTRAP_CONFIRM !== "CREATE_THREAD_SUPER_ADMIN")
    throw new Error("Set ADMIN_BOOTSTRAP_CONFIRM=CREATE_THREAD_SUPER_ADMIN to run bootstrap.");
  if (!environment.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  const result = registerSchema.safeParse({
    name: environment.ADMIN_BOOTSTRAP_NAME,
    email: environment.ADMIN_BOOTSTRAP_EMAIL,
    password: environment.ADMIN_BOOTSTRAP_PASSWORD,
  });
  if (!result.success)
    throw new Error(
      `Invalid ADMIN_BOOTSTRAP_* values: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  if (result.data.password.length < 14)
    throw new Error("The bootstrap password must contain at least 14 characters.");
  return result.data;
}

export async function bootstrapAdmin(
  input: ReturnType<typeof parseBootstrapEnvironment>,
): Promise<"created" | "already-exists"> {
  // A unique, shared migration document serializes concurrent bootstrap attempts.
  await Promise.all([UserModel.init(), SeedMigrationModel.init()]);
  const passwordHash = await hashPassword(input.password);
  return mongoose.connection.transaction(async (session) => {
    await SeedMigrationModel.findOneAndUpdate(
      { version: "admin-bootstrap-lock-v1" },
      { $set: { description: "Serialize initial administrator bootstrap", appliedAt: new Date() } },
      { upsert: true, session, runValidators: true },
    );
    const existing = await UserModel.findOne({ email: input.email }).session(session);
    if (existing?.roles.includes("super_admin") && existing.status === "active")
      return "already-exists";
    if (existing)
      throw new Error(
        "This email already belongs to an account. Bootstrap will not change its roles or password.",
      );
    if (await UserModel.exists({ roles: "super_admin" }).session(session))
      throw new Error(
        "A different super administrator already exists. Use that account; bootstrap will not create another.",
      );
    await UserModel.create(
      [
        {
          name: input.name,
          email: input.email,
          passwordHash,
          roles: ["super_admin"],
          mustChangePassword: true,
          authProviders: [{ provider: "password" }],
        },
      ],
      { session },
    );
    return "created";
  });
}
