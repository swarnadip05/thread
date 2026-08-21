import type { UserRole } from "@thread/types";

export interface AuthContext {
  readonly ip?: string;
  readonly requestId?: string;
  readonly userAgent?: string;
}

export interface AuthUserRecord {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly passwordHash?: string;
  readonly roles: readonly UserRole[];
  readonly status: "active" | "suspended" | "disabled";
  readonly emailVerifiedAt?: Date;
  readonly phoneVerifiedAt?: Date;
  readonly mustChangePassword: boolean;
  readonly failedAttempts: number;
  readonly backoffUntil?: Date;
  readonly totpEnabled: boolean;
}

export interface PublicAuthSession {
  readonly accessToken: string;
  readonly csrfToken: string;
  readonly expiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly user: AuthUserRecord;
}

export interface AccessTokenClaims {
  readonly subject: string;
  readonly roles: readonly UserRole[];
  readonly sessionFamilyId: string;
}
