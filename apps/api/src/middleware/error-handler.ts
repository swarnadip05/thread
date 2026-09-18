import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";
import { AuthError } from "../auth/auth.errors.js";
import { SafeProviderError } from "../payments/providers/payment.provider.js";

export class HttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new HttpError(404, "ROUTE_NOT_FOUND", `Route ${request.method} ${request.path} not found.`));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
      error = new HttpError(
        409,
        "DUPLICATE_RECORD",
        "This slug, email, SKU or variant combination already exists.",
      );
    const isCustomHttp =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode: unknown }).statusCode === "number" &&
      "code" in error;
    const httpError: HttpError | AuthError | SafeProviderError | null =
      error instanceof HttpError || error instanceof AuthError || error instanceof SafeProviderError
        ? error
        : isCustomHttp
          ? (error as HttpError)
          : null;
    const bodyParserError =
      typeof error === "object" && error !== null && "type" in error
        ? String(error.type)
        : undefined;
    const statusCode =
      httpError?.statusCode ?? (bodyParserError === "entity.too.large" ? 413 : 500);
    const code =
      httpError?.code ??
      (bodyParserError === "entity.too.large" ? "REQUEST_TOO_LARGE" : "INTERNAL_SERVER_ERROR");

    const reqId = (request as { requestId?: string }).requestId;
    if (statusCode >= 500) {
      logger.error({ err: error, requestId: reqId }, "Unhandled request error");
    }

    response.status(statusCode).json({
      success: false,
      error: {
        code,
        message:
          httpError?.message ??
          (statusCode === 413
            ? "Request body exceeds the allowed size."
            : "An unexpected error occurred."),
        requestId: reqId,
      },
    });
  };
}
