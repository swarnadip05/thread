import type { RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { ZodType } from "@thread/validation";
import type { UserRole } from "@thread/types";

import { HttpError } from "../../middleware/error-handler.js";
import type { AccessTokenService } from "../security/tokens.js";

export const REFRESH_COOKIE = "thread_refresh";
export const CSRF_COOKIE = "thread_csrf";

export function parseCookies(header: string | undefined): Readonly<Record<string, string>> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("=", 2))
      .filter((entry): entry is [string, string] => entry.length === 2)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success)
      return next(
        new HttpError(
          400,
          "VALIDATION_ERROR",
          result.error.issues[0]?.message ?? "Request data is invalid.",
        ),
      );
    request.body = result.data;
    next();
  };
}

export function createOriginGuard(webOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    const origin = request.header("origin");
    if (origin !== webOrigin)
      return next(new HttpError(403, "ORIGIN_REJECTED", "Request origin was rejected."));
    next();
  };
}

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const cookies = parseCookies(request.header("cookie"));
  const headerToken = request.header("x-csrf-token");
  if (!cookies[CSRF_COOKIE] || !headerToken || cookies[CSRF_COOKIE] !== headerToken)
    return next(new HttpError(403, "CSRF_REJECTED", "CSRF validation failed."));
  next();
};

export function authenticate(accessTokens: AccessTokenService): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer "))
      return next(new HttpError(401, "UNAUTHORIZED", "Authentication is required."));
    try {
      const claims = await accessTokens.verify(authorization.slice(7));
      request.auth = {
        userId: claims.subject,
        roles: claims.roles,
        sessionFamilyId: claims.sessionFamilyId,
      };
      next();
    } catch {
      next(new HttpError(401, "UNAUTHORIZED", "Authentication is required."));
    }
  };
}

export function requireRoles(...allowed: readonly UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth || !request.auth.roles.some((role) => allowed.includes(role)))
      return next(
        new HttpError(403, "FORBIDDEN", "You do not have permission to access this resource."),
      );
    next();
  };
}

export function authRateLimit(max: number, windowMs: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (request, response) =>
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts. Please try again later.",
          requestId: request.requestId,
        },
      }),
  });
}
