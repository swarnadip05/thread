import { describe, expect, it } from "vitest";

import { parseAdminPasswordResetEnvironment } from "../src/auth/reset-admin-password.js";

const validEnvironment = {
  NODE_ENV: "development",
  MONGODB_URI: "mongodb://localhost:27017/thread_commerce?replicaSet=rs0",
  ADMIN_RESET_CONFIRM: "RESET_THREAD_ADMIN_PASSWORD",
  ADMIN_RESET_EMAIL: "admin@example.com",
  ADMIN_RESET_PASSWORD: "StrongPassword123",
} satisfies NodeJS.ProcessEnv;

describe("admin password reset environment", () => {
  it("accepts an explicitly confirmed development reset", () => {
    expect(parseAdminPasswordResetEnvironment(validEnvironment)).toEqual({
      email: "admin@example.com",
      password: "StrongPassword123",
    });
  });

  it.each(["production", "test", undefined])("refuses NODE_ENV=%s", (nodeEnv) => {
    expect(() =>
      parseAdminPasswordResetEnvironment({ ...validEnvironment, NODE_ENV: nodeEnv }),
    ).toThrow(/production|NODE_ENV=development/);
  });

  it("requires the exact confirmation phrase", () => {
    expect(() =>
      parseAdminPasswordResetEnvironment({
        ...validEnvironment,
        ADMIN_RESET_CONFIRM: "RESET_ADMIN",
      }),
    ).toThrow("ADMIN_RESET_CONFIRM=RESET_THREAD_ADMIN_PASSWORD");
  });

  it.each(["ADMIN_RESET_EMAIL", "ADMIN_RESET_PASSWORD"] as const)(
    "requires a valid %s",
    (name) => {
      expect(() =>
        parseAdminPasswordResetEnvironment({ ...validEnvironment, [name]: undefined }),
      ).toThrow("Invalid ADMIN_RESET_* values");
    },
  );
});
