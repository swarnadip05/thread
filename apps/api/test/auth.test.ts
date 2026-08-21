import express from "express";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { UserRole } from "@thread/types";

import { createApp } from "../src/app.js";
import { AuthService } from "../src/auth/auth.service.js";
import type { AuthContext, AuthUserRecord } from "../src/auth/auth.types.js";
import { createAuthRouter } from "../src/auth/http/auth.router.js";
import { authenticate, requireRoles } from "../src/auth/http/security.middleware.js";
import type { EmailProvider } from "../src/auth/providers/email.provider.js";
import type { PhoneOtpProvider } from "../src/auth/providers/phone-otp.provider.js";
import type { AuditRepository } from "../src/auth/repositories/audit.repository.js";
import type {
  AuthTokenKind,
  AuthTokenRepository,
  ConsumedAuthToken,
} from "../src/auth/repositories/auth-token.repository.js";
import type {
  RotateResult,
  SessionRepository,
} from "../src/auth/repositories/session.repository.js";
import type { CreateUserInput, UserRepository } from "../src/auth/repositories/user.repository.js";
import { hashPassword } from "../src/auth/security/password.js";
import type { AccessTokenService } from "../src/auth/security/tokens.js";

const silentLogger = pino({ enabled: false });
const noopContext: AuthContext = { ip: "127.0.0.1", requestId: "test" };

class MemoryUsers implements UserRepository {
  readonly records = new Map<string, AuthUserRecord>();
  async create(input: CreateUserInput) {
    const id = `${this.records.size + 1}`.padStart(24, "0");
    const user: AuthUserRecord = {
      id,
      name: input.name,
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
      roles: input.roles ?? ["customer"],
      status: "active",
      mustChangePassword: input.mustChangePassword ?? false,
      failedAttempts: 0,
      totpEnabled: false,
    };
    this.records.set(id, user);
    return user;
  }
  async findByEmail(email: string) {
    return [...this.records.values()].find((user) => user.email === email) ?? null;
  }
  async findById(id: string) {
    return this.records.get(id) ?? null;
  }
  async findByPhone(phone: string) {
    return [...this.records.values()].find((user) => user.phone === phone) ?? null;
  }
  async findByProvider() {
    return null;
  }
  async recordFailedLogin(id: string, attempts: number, backoffUntil?: Date) {
    const user = this.records.get(id)!;
    this.records.set(id, {
      ...user,
      failedAttempts: attempts,
      ...(backoffUntil ? { backoffUntil } : {}),
    });
  }
  async recordSuccessfulLogin(id: string) {
    const user = this.records.get(id)!;
    this.records.set(id, { ...user, failedAttempts: 0 });
  }
  async markEmailVerified(id: string) {
    const user = this.records.get(id)!;
    this.records.set(id, { ...user, emailVerifiedAt: new Date() });
  }
  async markPhoneVerified(id: string) {
    const user = this.records.get(id)!;
    this.records.set(id, { ...user, phoneVerifiedAt: new Date() });
  }
  async setPassword(id: string, passwordHash: string, mustChangePassword = false) {
    const user = this.records.get(id)!;
    this.records.set(id, { ...user, passwordHash, mustChangePassword });
  }
  async linkGoogle() {}
  async hasSuperAdmin() {
    return [...this.records.values()].some((user) => user.roles.includes("super_admin"));
  }
  async anonymize(id: string) {
    const user = this.records.get(id);
    if (user)
      this.records.set(id, {
        id,
        name: "Deleted customer",
        roles: ["customer"],
        status: "disabled",
        mustChangePassword: false,
        failedAttempts: 0,
        totpEnabled: false,
      });
  }
}

interface MemorySession {
  expiresAt: Date;
  familyId: string;
  revoked: boolean;
  tokenHash: string;
  userId: string;
}
class MemorySessions implements SessionRepository {
  readonly records = new Map<string, MemorySession>();
  async create(input: {
    context: AuthContext;
    expiresAt: Date;
    familyId?: string;
    tokenHash: string;
    userId: string;
  }) {
    const familyId = input.familyId ?? `family-${this.records.size + 1}`;
    this.records.set(input.tokenHash, {
      expiresAt: input.expiresAt,
      familyId,
      revoked: false,
      tokenHash: input.tokenHash,
      userId: input.userId,
    });
    return familyId;
  }
  async rotate(input: {
    context: AuthContext;
    expiresAt: Date;
    newTokenHash: string;
    tokenHash: string;
  }): Promise<RotateResult> {
    const current = this.records.get(input.tokenHash);
    if (!current || current.expiresAt < new Date()) return { status: "invalid" };
    if (current.revoked) {
      await this.revokeFamily(current.familyId);
      return { status: "reuse", familyId: current.familyId, userId: current.userId };
    }
    current.revoked = true;
    await this.create({
      context: input.context,
      expiresAt: input.expiresAt,
      familyId: current.familyId,
      tokenHash: input.newTokenHash,
      userId: current.userId,
    });
    return { status: "rotated", familyId: current.familyId, userId: current.userId };
  }
  async revokeCurrent(tokenHash: string) {
    const value = this.records.get(tokenHash);
    if (value) value.revoked = true;
  }
  async revokeFamily(familyId: string) {
    for (const value of this.records.values())
      if (value.familyId === familyId) value.revoked = true;
  }
  async revokeAllForUser(userId: string) {
    for (const value of this.records.values()) if (value.userId === userId) value.revoked = true;
  }
}

class MemoryAuthTokens implements AuthTokenRepository {
  readonly records = new Map<
    string,
    { consumed: boolean; expiresAt: Date; kind: AuthTokenKind; target: string; userId: string }
  >();
  async issue(input: {
    expiresAt: Date;
    kind: AuthTokenKind;
    target: string;
    tokenHash: string;
    userId: string;
  }) {
    this.records.set(`${input.kind}:${input.tokenHash}`, { ...input, consumed: false });
  }
  async consume(kind: AuthTokenKind, tokenHash: string): Promise<ConsumedAuthToken | null> {
    const item = this.records.get(`${kind}:${tokenHash}`);
    if (!item || item.consumed || item.expiresAt < new Date()) return null;
    item.consumed = true;
    return { target: item.target, userId: item.userId };
  }
  async revokeAllForUser(userId: string) {
    for (const token of this.records.values()) if (token.userId === userId) token.consumed = true;
  }
}

class MemoryEmail implements EmailProvider {
  verificationToken = "";
  resetToken = "";
  async sendPasswordReset(input: { token: string }) {
    this.resetToken = input.token;
  }
  async sendVerification(input: { token: string }) {
    this.verificationToken = input.token;
  }
}
class FakeAccessTokens implements AccessTokenService {
  async issue(input: { subject: string; roles: readonly UserRole[]; sessionFamilyId: string }) {
    return JSON.stringify(input);
  }
  async verify(token: string) {
    return JSON.parse(token) as { subject: string; roles: UserRole[]; sessionFamilyId: string };
  }
}
class NoopAudit implements AuditRepository {
  async record() {}
}
class NoopPhone implements PhoneOtpProvider {
  async deliver() {}
}

let users: MemoryUsers;
let sessions: MemorySessions;
let tokens: MemoryAuthTokens;
let email: MemoryEmail;
let accessTokens: FakeAccessTokens;
let auth: AuthService;

beforeEach(() => {
  users = new MemoryUsers();
  sessions = new MemorySessions();
  tokens = new MemoryAuthTokens();
  email = new MemoryEmail();
  accessTokens = new FakeAccessTokens();
  auth = new AuthService(
    users,
    sessions,
    tokens,
    new NoopAudit(),
    accessTokens,
    email,
    new NoopPhone(),
    {
      accessTokenTtlSeconds: 900,
      emailVerificationTtlMinutes: 60,
      passwordResetTtlMinutes: 30,
      phoneAuthEnabled: false,
      refreshTokenTtlDays: 30,
      totpEnabled: false,
    },
  );
});

async function addCustomer(password = "StrongPass123") {
  return users.create({
    email: "customer@example.com",
    name: "Customer",
    passwordHash: await hashPassword(password),
  });
}

describe("authentication service", () => {
  it("registers a customer and creates an email verification flow", async () => {
    const session = await auth.register(
      { email: "new@example.com", name: "New Customer", password: "StrongPass123" },
      noopContext,
    );
    expect(session.user.roles).toEqual(["customer"]);
    expect(email.verificationToken.length).toBeGreaterThan(30);
    expect(session.refreshToken).not.toBe(session.accessToken);
  });
  it("verifies an email token only once", async () => {
    const session = await auth.register(
      { email: "verify@example.com", name: "Verify Customer", password: "StrongPass123" },
      noopContext,
    );
    await auth.verifyEmail(email.verificationToken, noopContext);
    expect((await users.findById(session.user.id))?.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(auth.verifyEmail(email.verificationToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_VERIFICATION_TOKEN",
    });
  });
  it("logs in with a password and rejects an invalid password", async () => {
    await addCustomer();
    await expect(
      auth.login({ email: "customer@example.com", password: "StrongPass123" }, noopContext),
    ).resolves.toMatchObject({ user: { email: "customer@example.com" } });
    await expect(
      auth.login({ email: "customer@example.com", password: "wrong" }, noopContext),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("rotates refresh tokens and revokes the family when an old token is reused", async () => {
    await addCustomer();
    const first = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    const second = await auth.refresh(first.refreshToken, noopContext);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(auth.refresh(first.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
    await expect(auth.refresh(second.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
  it("logs out the current session and rejects its refresh token", async () => {
    await addCustomer();
    const session = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    await auth.logout(session.refreshToken, noopContext);
    await expect(auth.refresh(session.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
  it("logs out every session for a user", async () => {
    const user = await addCustomer();
    const first = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    const second = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    await auth.logoutAll(user.id, noopContext);
    await expect(auth.refresh(first.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
    await expect(auth.refresh(second.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
  it("resets a password once and revokes existing sessions", async () => {
    await addCustomer();
    const oldSession = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    await auth.requestPasswordReset("customer@example.com", noopContext);
    await auth.resetPassword(
      { password: "NewStrongPass456", token: email.resetToken },
      noopContext,
    );
    await expect(auth.refresh(oldSession.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
    await expect(
      auth.login({ email: "customer@example.com", password: "NewStrongPass456" }, noopContext),
    ).resolves.toBeDefined();
    await expect(
      auth.resetPassword({ password: "AnotherPass789", token: email.resetToken }, noopContext),
    ).rejects.toMatchObject({ code: "INVALID_RESET_TOKEN" });
  });
  it("anonymizes a customer only after password verification", async () => {
    const user = await addCustomer();
    const session = await auth.login(
      { email: "customer@example.com", password: "StrongPass123" },
      noopContext,
    );
    await expect(
      auth.deleteAccount(user.id, "incorrect-password", noopContext),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await auth.deleteAccount(user.id, "StrongPass123", noopContext);
    expect(await users.findById(user.id)).toMatchObject({
      name: "Deleted customer",
      status: "disabled",
    });
    expect(await users.findByEmail("customer@example.com")).toBeNull();
    await expect(auth.refresh(session.refreshToken, noopContext)).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
  });
});

describe("authorization and HTTP security", () => {
  it("enforces route-level RBAC", async () => {
    const app = express();
    app.get("/admin", authenticate(accessTokens), requireRoles("admin"), (_request, response) =>
      response.sendStatus(204),
    );
    const customer = await accessTokens.issue({
      subject: "user",
      roles: ["customer"],
      sessionFamilyId: "family",
    });
    const admin = await accessTokens.issue({
      subject: "admin",
      roles: ["admin"],
      sessionFamilyId: "family",
    });
    await request(app).get("/admin").set("authorization", `Bearer ${customer}`).expect(403);
    await request(app).get("/admin").set("authorization", `Bearer ${admin}`).expect(204);
  });
  it("rejects refresh without a matching CSRF token", async () => {
    const router = createAuthRouter(auth, authenticate(accessTokens), {
      isProduction: false,
      webOrigin: "http://localhost:3000",
    });
    const app = createApp({
      authRouter: router,
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("origin", "http://localhost:3000")
      .set("cookie", "thread_refresh=opaque")
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("CSRF_REJECTED"));
  });
  it("rate limits repeated login attempts", async () => {
    const router = createAuthRouter(auth, authenticate(accessTokens), {
      isProduction: false,
      loginRateLimit: 1,
      webOrigin: "http://localhost:3000",
    });
    const app = createApp({
      authRouter: router,
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    const payload = { email: "none@example.com", password: "wrong" };
    await request(app)
      .post("/api/v1/auth/login")
      .set("origin", "http://localhost:3000")
      .send(payload)
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .set("origin", "http://localhost:3000")
      .send(payload)
      .expect(429)
      .expect(({ body }) => expect(body.error.code).toBe("RATE_LIMITED"));
  });
});
