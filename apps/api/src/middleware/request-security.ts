import type { RequestHandler } from "express";

import { HttpError } from "./error-handler.js";

const bodyMethods = new Set(["POST", "PUT", "PATCH"]);

export const requireJsonContentType: RequestHandler = (request, _response, next) => {
  if (!bodyMethods.has(request.method)) return next();
  const contentLength = Number(request.headers["content-length"] ?? 0);
  const hasBody =
    (Number.isFinite(contentLength) && contentLength > 0) ||
    request.headers["transfer-encoding"] !== undefined;
  if (hasBody && !request.is("application/json"))
    return next(
      new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Request body must use application/json."),
    );
  next();
};

export const rejectPrototypePollution: RequestHandler = (request, _response, next) => {
  const unsafe = /(?:^|[?&])(?:__proto__|prototype|constructor)(?:\[|=|%5B)/i.test(
    request.originalUrl,
  );
  if (unsafe)
    return next(new HttpError(400, "UNSAFE_INPUT", "Request data contains an unsafe key."));
  next();
};
