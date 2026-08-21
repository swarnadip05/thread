import type { Logger } from "pino";
import type { RequestHandler, Router } from "express";

import type { ApiConfig } from "../config/env.js";
import { AuthService } from "./auth.service.js";
import { createAuthRouter } from "./http/auth.router.js";
import { authenticate } from "./http/security.middleware.js";
import { DevelopmentEmailProvider, UnconfiguredEmailProvider } from "./providers/email.provider.js";
import { GoogleOAuthProvider } from "./providers/google-oauth.provider.js";
import {
  ApprovedSmsProviderStub,
  DevelopmentPhoneOtpProvider,
} from "./providers/phone-otp.provider.js";
import { MongooseAuditRepository } from "./repositories/audit.repository.js";
import { MongooseAuthTokenRepository } from "./repositories/auth-token.repository.js";
import { MongooseSessionRepository } from "./repositories/session.repository.js";
import { MongooseUserRepository } from "./repositories/user.repository.js";
import { JwtAccessTokenService } from "./security/tokens.js";
import type { AccessTokenService } from "./security/tokens.js";
import type { EmailProvider } from "./providers/email.provider.js";

export interface AuthComposition {
  readonly accessTokens: AccessTokenService;
  readonly authenticate: RequestHandler;
  readonly router: Router;
}

export function composeAuth(
  config: ApiConfig,
  logger: Logger,
  queuedEmailProvider?: EmailProvider,
): AuthComposition {
  const accessTokens = new JwtAccessTokenService(
    config.accessTokenSecret,
    config.accessTokenIssuer,
    config.accessTokenAudience,
    config.accessTokenTtlSeconds,
  );
  const auth = new AuthService(
    new MongooseUserRepository(),
    new MongooseSessionRepository(),
    new MongooseAuthTokenRepository(),
    new MongooseAuditRepository(),
    accessTokens,
    queuedEmailProvider ??
      (config.nodeEnv === "production"
        ? new UnconfiguredEmailProvider()
        : new DevelopmentEmailProvider(logger)),
    config.nodeEnv === "production"
      ? new ApprovedSmsProviderStub()
      : new DevelopmentPhoneOtpProvider(logger),
    {
      accessTokenTtlSeconds: config.accessTokenTtlSeconds,
      emailVerificationTtlMinutes: 24 * 60,
      passwordResetTtlMinutes: 30,
      phoneAuthEnabled: config.phoneAuthEnabled,
      refreshTokenTtlDays: 30,
      totpEnabled: config.totpEnabled,
    },
  );
  const googleOAuth = config.googleOAuth ? new GoogleOAuthProvider(config.googleOAuth) : undefined;
  const authenticateRequest = authenticate(accessTokens);
  return {
    accessTokens,
    authenticate: authenticateRequest,
    router: createAuthRouter(auth, authenticateRequest, {
      ...(config.cookieDomain ? { cookieDomain: config.cookieDomain } : {}),
      ...(googleOAuth ? { googleOAuth } : {}),
      isProduction: config.nodeEnv === "production",
      webOrigin: config.webOrigin,
    }),
  };
}
