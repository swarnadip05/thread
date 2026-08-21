import pino, { type Logger, type LoggerOptions } from "pino";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["idempotency-key"]',
  'req.headers["x-csrf-token"]',
  'req.headers["x-razorpay-signature"]',
  "res.headers.set-cookie",
  "password",
  "accessToken",
  "refreshToken",
  "paymentSignature",
  "razorpay_signature",
  "signature",
  "req.body.password",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.token",
  "req.body.signature",
  "req.body.address",
  "req.body.phone",
  "req.body.email",
  "providerPayload",
  "payload",
  "*.password",
  "*.token",
  "*.signature",
];

export function createLogger(options: {
  readonly level: string;
  readonly nodeEnv: "development" | "production" | "test";
}): Logger {
  const loggerOptions: LoggerOptions = {
    level: options.level,
    redact: {
      paths: redactPaths,
      censor: "[REDACTED]",
    },
  };

  if (options.nodeEnv === "development") {
    loggerOptions.transport = {
      target: "pino-pretty",
      options: { colorize: true, singleLine: true, translateTime: "SYS:standard" },
    };
  }

  return pino(loggerOptions);
}
