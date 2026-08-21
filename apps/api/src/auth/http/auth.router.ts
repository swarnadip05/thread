import { Router, type Request, type Response } from "express";
import type { CookieOptions } from "express";
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  accountDeletionSchema,
} from "@thread/validation";

import type { AuthService } from "../auth.service.js";
import type { AuthContext, PublicAuthSession } from "../auth.types.js";
import type { GoogleOAuthProvider } from "../providers/google-oauth.provider.js";
import { generateOpaqueToken } from "../security/tokens.js";
import {
  authRateLimit,
  createOriginGuard,
  CSRF_COOKIE,
  parseCookies,
  REFRESH_COOKIE,
  requireCsrf,
  requireRoles,
  validateBody,
} from "./security.middleware.js";
import type { authenticate } from "./security.middleware.js";

const GOOGLE_STATE_COOKIE = "thread_google_state";
const GOOGLE_VERIFIER_COOKIE = "thread_google_verifier";

export interface AuthRouterConfig {
  readonly cookieDomain?: string;
  readonly googleOAuth?: GoogleOAuthProvider;
  readonly isProduction: boolean;
  readonly loginRateLimit?: number;
  readonly otpRateLimit?: number;
  readonly passwordResetRateLimit?: number;
  readonly webOrigin: string;
}

function context(request: Request): AuthContext {
  const ip = request.ip;
  const userAgent = request.header("user-agent")?.slice(0, 512);
  return {
    ...(ip ? { ip } : {}),
    requestId: request.requestId,
    ...(userAgent ? { userAgent } : {}),
  };
}

export function createAuthRouter(
  auth: AuthService,
  accessTokenMiddleware: ReturnType<typeof authenticate>,
  config: AuthRouterConfig,
): Router {
  const router = Router();
  const cookieBase: CookieOptions = {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/api/v1/auth",
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  };
  const csrfCookie: CookieOptions = { ...cookieBase, httpOnly: false, path: "/" };
  const setSession = (response: Response, session: PublicAuthSession) => {
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...cookieBase,
      expires: session.refreshExpiresAt,
    });
    response.cookie(CSRF_COOKIE, session.csrfToken, {
      ...csrfCookie,
      expires: session.refreshExpiresAt,
    });
  };
  const clearSession = (response: Response) => {
    response.clearCookie(REFRESH_COOKIE, cookieBase);
    response.clearCookie(CSRF_COOKIE, csrfCookie);
  };
  const readRefresh = (request: Request) => parseCookies(request.header("cookie"))[REFRESH_COOKIE];

  router.use(createOriginGuard(config.webOrigin));

  router.post(
    "/register",
    authRateLimit(config.loginRateLimit ?? 10, 15 * 60_000),
    validateBody(registerSchema),
    async (request, response) => {
      const session = await auth.register(request.body, context(request));
      setSession(response, session);
      response.status(201).json({ success: true, data: auth.toDto(session) });
    },
  );
  router.delete(
    "/account",
    accessTokenMiddleware,
    requireCsrf,
    validateBody(accountDeletionSchema),
    async (request, response) => {
      await auth.deleteAccount(request.auth!.userId, request.body.password, context(request));
      clearSession(response);
      response.status(204).send();
    },
  );
  router.post(
    "/login",
    authRateLimit(config.loginRateLimit ?? 10, 15 * 60_000),
    validateBody(loginSchema),
    async (request, response) => {
      const session = await auth.login(request.body, context(request));
      setSession(response, session);
      response.status(200).json({ success: true, data: auth.toDto(session) });
    },
  );
  router.post("/refresh", requireCsrf, async (request, response) => {
    const refreshToken = readRefresh(request);
    if (!refreshToken)
      return response.status(401).json({
        success: false,
        error: {
          code: "INVALID_SESSION",
          message: "Your session is invalid or has expired.",
          requestId: request.requestId,
        },
      });
    const session = await auth.refresh(refreshToken, context(request));
    setSession(response, session);
    response.status(200).json({ success: true, data: auth.toDto(session) });
  });
  router.post("/logout", requireCsrf, async (request, response) => {
    const refreshToken = readRefresh(request);
    if (refreshToken) await auth.logout(refreshToken, context(request));
    clearSession(response);
    response.status(204).send();
  });
  router.post("/logout-all", accessTokenMiddleware, async (request, response) => {
    await auth.logoutAll(request.auth!.userId, context(request));
    clearSession(response);
    response.status(204).send();
  });
  router.get("/me", accessTokenMiddleware, async (request, response) =>
    response
      .status(200)
      .json({ success: true, data: auth.userToDto(await auth.getUser(request.auth!.userId)) }),
  );
  router.get(
    "/admin/session",
    accessTokenMiddleware,
    requireRoles("super_admin", "admin", "catalog_manager", "order_manager", "support_agent"),
    async (request, response) =>
      response
        .status(200)
        .json({ success: true, data: auth.userToDto(await auth.getUser(request.auth!.userId)) }),
  );
  router.post(
    "/change-password",
    accessTokenMiddleware,
    validateBody(changePasswordSchema),
    async (request, response) => {
      await auth.changePassword(
        request.auth!.userId,
        request.body.currentPassword,
        request.body.newPassword,
        context(request),
      );
      clearSession(response);
      response.status(204).send();
    },
  );

  router.post("/email/verify", validateBody(tokenSchema), async (request, response) => {
    await auth.verifyEmail(request.body.token, context(request));
    response.status(204).send();
  });
  router.post(
    "/email/resend",
    authRateLimit(config.passwordResetRateLimit ?? 5, 60 * 60_000),
    validateBody(emailOnlySchema),
    async (request, response) => {
      await auth.resendVerification(request.body.email);
      response.status(202).json({
        success: true,
        data: { message: "If verification is available, instructions will be sent." },
      });
    },
  );
  router.post(
    "/password/forgot",
    authRateLimit(config.passwordResetRateLimit ?? 5, 60 * 60_000),
    validateBody(emailOnlySchema),
    async (request, response) => {
      await auth.requestPasswordReset(request.body.email, context(request));
      response.status(202).json({
        success: true,
        data: { message: "If an account exists, reset instructions will be sent." },
      });
    },
  );
  router.post(
    "/password/reset",
    authRateLimit(config.passwordResetRateLimit ?? 5, 60 * 60_000),
    validateBody(resetPasswordSchema),
    async (request, response) => {
      await auth.resetPassword(request.body, context(request));
      clearSession(response);
      response.status(204).send();
    },
  );
  router.post(
    "/phone/request",
    authRateLimit(config.otpRateLimit ?? 5, 10 * 60_000),
    validateBody(phoneOtpRequestSchema),
    async (request, response) => {
      await auth.requestPhoneOtp(request.body.phone);
      response.status(202).json({
        success: true,
        data: { message: "If phone login is available, a code will be sent." },
      });
    },
  );
  router.post(
    "/phone/verify",
    authRateLimit(config.otpRateLimit ?? 5, 10 * 60_000),
    validateBody(phoneOtpVerifySchema),
    async (request, response) => {
      const session = await auth.verifyPhoneOtp(
        request.body.phone,
        request.body.code,
        context(request),
      );
      setSession(response, session);
      response.status(200).json({ success: true, data: auth.toDto(session) });
    },
  );

  if (config.googleOAuth) {
    router.get("/google/start", (_request, response) => {
      const state = generateOpaqueToken(24);
      const verifier = generateOpaqueToken(48);
      const oauthCookie = {
        ...cookieBase,
        sameSite: "lax" as const,
        maxAge: 10 * 60_000,
        path: "/api/v1/auth/google",
      };
      response.cookie(GOOGLE_STATE_COOKIE, state, oauthCookie);
      response.cookie(GOOGLE_VERIFIER_COOKIE, verifier, oauthCookie);
      response.redirect(config.googleOAuth!.authorizationUrl(state, verifier));
    });
    router.get("/google/callback", async (request, response) => {
      const cookies = parseCookies(request.header("cookie"));
      if (
        typeof request.query.code !== "string" ||
        typeof request.query.state !== "string" ||
        request.query.state !== cookies[GOOGLE_STATE_COOKIE] ||
        !cookies[GOOGLE_VERIFIER_COOKIE]
      )
        return response.redirect(`${config.webOrigin}/auth?error=oauth`);
      const profile = await config.googleOAuth!.exchange(
        request.query.code,
        cookies[GOOGLE_VERIFIER_COOKIE],
      );
      const session = await auth.completeGoogleLogin(profile, context(request));
      setSession(response, session);
      response.clearCookie(GOOGLE_STATE_COOKIE, { ...cookieBase, path: "/api/v1/auth/google" });
      response.clearCookie(GOOGLE_VERIFIER_COOKIE, { ...cookieBase, path: "/api/v1/auth/google" });
      response.redirect(`${config.webOrigin}/account`);
    });
  }

  return router;
}
