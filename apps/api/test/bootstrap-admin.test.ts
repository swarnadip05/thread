import { describe, expect, it } from "vitest";
import { UserModel } from "../src/models/user.model.js";
import { JwtAccessTokenService } from "../src/auth/security/tokens.js";
import type { UserRole } from "@thread/types";
import { parseBootstrapEnvironment } from "../src/auth/bootstrap-admin.js";

const environment = {
  MONGODB_URI: "mongodb://localhost:27017/thread_test",
  ADMIN_BOOTSTRAP_CONFIRM: "CREATE_THREAD_SUPER_ADMIN",
  ADMIN_BOOTSTRAP_NAME: " Local Administrator ",
  ADMIN_BOOTSTRAP_EMAIL: " ADMIN@EXAMPLE.TEST ",
  ADMIN_BOOTSTRAP_PASSWORD: "TestOnlyPassword123!",
};
describe("administrator bootstrap validation", () => {
  it("normalizes the identity used for idempotency", () => {
    expect(parseBootstrapEnvironment(environment)).toMatchObject({
      name: "Local Administrator",
      email: "admin@example.test",
    });
  });
  it("rejects missing confirmation, database, invalid email and un-loginable passwords", () => {
    for (const patch of [
      { ADMIN_BOOTSTRAP_CONFIRM: "yes" },
      { MONGODB_URI: "" },
      { ADMIN_BOOTSTRAP_EMAIL: "invalid" },
      { ADMIN_BOOTSTRAP_PASSWORD: "ShortA1" },
      { ADMIN_BOOTSTRAP_PASSWORD: "a".repeat(129) },
    ]) {
      expect(() => parseBootstrapEnvironment({ ...environment, ...patch })).toThrow();
    }
  });
});

describe("Mongoose-backed admin authentication", () => {
  it("issues a JWT from Mongoose role arrays without structuredClone errors", async () => {
    const user = new UserModel({ name: "Administrator", email: "admin@example.test", roles: ["super_admin"] });
    const tokens = new JwtAccessTokenService("test-only-secret-".repeat(3), "thread-api", "thread-web", 900);
    const token = await tokens.issue({ subject: user.id, roles: user.roles as UserRole[], sessionFamilyId: "test-family" });
    expect((await tokens.verify(token)).roles).toEqual(["super_admin"]);
  });
});
