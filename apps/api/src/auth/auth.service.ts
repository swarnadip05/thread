import { randomInt } from "node:crypto";

import type { AuthSessionDto, AuthUserDto } from "@thread/types";
import type { LoginInput, RegisterInput, ResetPasswordInput } from "@thread/validation";

import { AuthError, invalidCredentialsError, invalidSessionError } from "./auth.errors.js";
import type { AuthContext, AuthUserRecord, PublicAuthSession } from "./auth.types.js";
import type { EmailProvider } from "./providers/email.provider.js";
import type { PhoneOtpProvider } from "./providers/phone-otp.provider.js";
import type { AuditRepository } from "./repositories/audit.repository.js";
import type { AuthTokenRepository } from "./repositories/auth-token.repository.js";
import type { SessionRepository } from "./repositories/session.repository.js";
import type { UserRepository } from "./repositories/user.repository.js";
import { hashPassword, verifyPassword } from "./security/password.js";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  type AccessTokenService,
} from "./security/tokens.js";

export interface AuthServiceOptions {
  readonly accessTokenTtlSeconds: number;
  readonly emailVerificationTtlMinutes: number;
  readonly passwordResetTtlMinutes: number;
  readonly phoneAuthEnabled: boolean;
  readonly refreshTokenTtlDays: number;
  readonly totpEnabled: boolean;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly authTokens: AuthTokenRepository,
    private readonly audits: AuditRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly emailProvider: EmailProvider,
    private readonly phoneOtpProvider: PhoneOtpProvider,
    private readonly options: AuthServiceOptions,
  ) {}

  async register(input: RegisterInput, context: AuthContext): Promise<PublicAuthSession> {
    if (await this.users.findByEmail(input.email))
      throw new AuthError("ACCOUNT_EXISTS", 409, "An account already uses these details.");
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    await this.sendEmailVerification(user);
    await this.audits.record({
      action: "auth.registered",
      actorId: user.id,
      context,
      entityId: user.id,
    });
    return this.createSession(user, context);
  }

  async login(input: LoginInput, context: AuthContext): Promise<PublicAuthSession> {
    const user = await this.users.findByEmail(input.email, true);
    const valid = await verifyPassword(user?.passwordHash, input.password);
    if (!user || !valid) {
      if (user) await this.recordFailedLogin(user);
      throw invalidCredentialsError();
    }
    if (user.status !== "active") throw invalidCredentialsError();
    if (user.backoffUntil && user.backoffUntil > new Date())
      throw new AuthError("LOGIN_BACKOFF", 429, "Please wait briefly before trying again.");
    if (this.options.totpEnabled && user.totpEnabled)
      throw new AuthError("TOTP_REQUIRED", 403, "A two-factor code is required.");
    await this.users.recordSuccessfulLogin(user.id);
    await this.audits.record({
      action: "auth.login",
      actorId: user.id,
      context,
      entityId: user.id,
    });
    return this.createSession({ ...user, failedAttempts: 0 }, context);
  }

  async refresh(refreshToken: string, context: AuthContext): Promise<PublicAuthSession> {
    const newRefreshToken = generateOpaqueToken();
    const result = await this.sessions.rotate({
      context,
      expiresAt: this.refreshExpiry(),
      newTokenHash: hashOpaqueToken(newRefreshToken),
      tokenHash: hashOpaqueToken(refreshToken),
    });
    if (result.status === "invalid") throw invalidSessionError();
    if (result.status === "reuse") {
      await this.audits.record({
        action: "auth.refresh_reuse_detected",
        actorId: result.userId,
        context,
        entityId: result.familyId,
      });
      throw invalidSessionError();
    }
    const user = await this.users.findById(result.userId);
    if (!user || user.status !== "active") {
      await this.sessions.revokeFamily(result.familyId, "user-unavailable");
      throw invalidSessionError();
    }
    return this.buildSessionPayload(user, result.familyId, newRefreshToken);
  }

  async logout(refreshToken: string, context: AuthContext): Promise<void> {
    await this.sessions.revokeCurrent(hashOpaqueToken(refreshToken), "logout");
    await this.audits.record({ action: "auth.logout", context });
  }

  async logoutAll(userId: string, context: AuthContext): Promise<void> {
    await this.sessions.revokeAllForUser(userId, "logout-all");
    await this.audits.record({
      action: "auth.logout_all",
      actorId: userId,
      context,
      entityId: userId,
    });
  }

  async requestPasswordReset(email: string, context: AuthContext): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.email || user.status !== "active") return;
    const token = generateOpaqueToken();
    await this.authTokens.issue({
      expiresAt: new Date(Date.now() + this.options.passwordResetTtlMinutes * 60_000),
      kind: "password_reset",
      target: user.email,
      tokenHash: hashOpaqueToken(token),
      userId: user.id,
    });
    await this.emailProvider.sendPasswordReset({ email: user.email, name: user.name, token });
    await this.audits.record({
      action: "auth.password_reset_requested",
      actorId: user.id,
      context,
      entityId: user.id,
    });
  }

  async resetPassword(input: ResetPasswordInput, context: AuthContext): Promise<void> {
    const consumed = await this.authTokens.consume("password_reset", hashOpaqueToken(input.token));
    if (!consumed)
      throw new AuthError("INVALID_RESET_TOKEN", 400, "This reset link is invalid or expired.");
    await this.users.setPassword(consumed.userId, await hashPassword(input.password));
    await this.sessions.revokeAllForUser(consumed.userId, "password-reset");
    await this.audits.record({
      action: "auth.password_reset",
      actorId: consumed.userId,
      context,
      entityId: consumed.userId,
    });
  }

  async verifyEmail(token: string, context: AuthContext): Promise<void> {
    const consumed = await this.authTokens.consume("email_verification", hashOpaqueToken(token));
    if (!consumed)
      throw new AuthError(
        "INVALID_VERIFICATION_TOKEN",
        400,
        "This verification link is invalid or expired.",
      );
    await this.users.markEmailVerified(consumed.userId);
    await this.audits.record({
      action: "auth.email_verified",
      actorId: consumed.userId,
      context,
      entityId: consumed.userId,
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.email || user.emailVerifiedAt || user.status !== "active") return;
    await this.sendEmailVerification(user);
  }

  async requestPhoneOtp(phone: string): Promise<void> {
    if (!this.options.phoneAuthEnabled)
      throw new AuthError("PHONE_AUTH_DISABLED", 404, "Phone authentication is unavailable.");
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const user = await this.users.findByPhone(phone);
    if (!user) {
      await this.phoneOtpProvider.deliver(phone, code);
      return;
    }
    await this.authTokens.issue({
      expiresAt: new Date(Date.now() + 5 * 60_000),
      kind: "phone_otp",
      target: phone,
      tokenHash: hashOpaqueToken(`${phone}:${code}`),
      userId: user.id,
    });
    await this.phoneOtpProvider.deliver(phone, code);
  }

  async verifyPhoneOtp(
    phone: string,
    code: string,
    context: AuthContext,
  ): Promise<PublicAuthSession> {
    if (!this.options.phoneAuthEnabled)
      throw new AuthError("PHONE_AUTH_DISABLED", 404, "Phone authentication is unavailable.");
    const consumed = await this.authTokens.consume(
      "phone_otp",
      hashOpaqueToken(`${phone}:${code}`),
    );
    if (!consumed) throw new AuthError("INVALID_OTP", 400, "The code is invalid or expired.");
    await this.users.markPhoneVerified(consumed.userId);
    const user = await this.users.findById(consumed.userId);
    if (!user) throw invalidCredentialsError();
    await this.audits.record({
      action: "auth.phone_verified",
      actorId: user.id,
      context,
      entityId: user.id,
    });
    return this.createSession({ ...user, phoneVerifiedAt: new Date() }, context);
  }

  async completeGoogleLogin(
    profile: { email: string; name: string; providerUserId: string },
    context: AuthContext,
  ): Promise<PublicAuthSession> {
    let user = await this.users.findByProvider("google", profile.providerUserId);
    if (!user) {
      user = await this.users.findByEmail(profile.email);
      if (user) await this.users.linkGoogle(user.id, profile.providerUserId);
      else user = await this.users.create({ name: profile.name, email: profile.email });
    }
    if (!user.emailVerifiedAt) await this.users.markEmailVerified(user.id);
    return this.createSession(
      { ...user, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      context,
    );
  }

  async getUser(userId: string): Promise<AuthUserRecord> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== "active") throw invalidSessionError();
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: AuthContext,
  ): Promise<void> {
    const user = await this.users.findById(userId, true);
    if (!user || !(await verifyPassword(user.passwordHash, currentPassword)))
      throw invalidCredentialsError();
    await this.users.setPassword(user.id, await hashPassword(newPassword), false);
    await this.sessions.revokeAllForUser(user.id, "password-changed");
    await this.audits.record({
      action: "auth.password_changed",
      actorId: user.id,
      context,
      entityId: user.id,
    });
  }

  async deleteAccount(userId: string, password: string, context: AuthContext): Promise<void> {
    const user = await this.users.findById(userId, true);
    if (!user || user.roles.some((role) => role !== "customer"))
      throw new AuthError(
        "ACCOUNT_DELETION_REQUIRES_SUPPORT",
        403,
        "This account requires assisted deletion.",
      );
    if (!(await verifyPassword(user.passwordHash, password))) throw invalidCredentialsError();
    await this.sessions.revokeAllForUser(user.id, "account-deleted");
    await this.authTokens.revokeAllForUser(user.id);
    await this.audits.record({
      action: "auth.account_anonymized",
      actorId: user.id,
      context,
      entity: "user",
      entityId: user.id,
    });
    await this.users.anonymize(user.id);
  }

  toDto(session: PublicAuthSession): AuthSessionDto {
    return {
      accessToken: session.accessToken,
      csrfToken: session.csrfToken,
      expiresInSeconds: session.expiresInSeconds,
      user: this.userToDto(session.user),
    };
  }

  userToDto(user: AuthUserRecord): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      ...(user.email ? { email: user.email } : {}),
      ...(user.phone ? { phone: user.phone } : {}),
      roles: user.roles,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async createSession(
    user: AuthUserRecord,
    context: AuthContext,
  ): Promise<PublicAuthSession> {
    const refreshToken = generateOpaqueToken();
    const familyId = await this.sessions.create({
      context,
      expiresAt: this.refreshExpiry(),
      tokenHash: hashOpaqueToken(refreshToken),
      userId: user.id,
    });
    return this.buildSessionPayload(user, familyId, refreshToken);
  }

  private async buildSessionPayload(
    user: AuthUserRecord,
    familyId: string,
    refreshToken: string,
  ): Promise<PublicAuthSession> {
    return {
      accessToken: await this.accessTokens.issue({
        subject: user.id,
        roles: user.roles,
        sessionFamilyId: familyId,
      }),
      csrfToken: generateOpaqueToken(24),
      expiresInSeconds: this.options.accessTokenTtlSeconds,
      refreshToken,
      refreshExpiresAt: this.refreshExpiry(),
      user,
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + this.options.refreshTokenTtlDays * 86_400_000);
  }

  private async recordFailedLogin(user: AuthUserRecord): Promise<void> {
    const attempts = user.failedAttempts + 1;
    const backoffSeconds = attempts < 5 ? 0 : Math.min(60, 2 ** (attempts - 5));
    await this.users.recordFailedLogin(
      user.id,
      attempts,
      backoffSeconds ? new Date(Date.now() + backoffSeconds * 1000) : undefined,
    );
  }

  private async sendEmailVerification(user: AuthUserRecord): Promise<void> {
    if (!user.email) return;
    const token = generateOpaqueToken();
    await this.authTokens.issue({
      expiresAt: new Date(Date.now() + this.options.emailVerificationTtlMinutes * 60_000),
      kind: "email_verification",
      target: user.email,
      tokenHash: hashOpaqueToken(token),
      userId: user.id,
    });
    await this.emailProvider.sendVerification({ email: user.email, name: user.name, token });
  }
}
