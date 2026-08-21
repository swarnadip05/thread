export interface ApiConfig {
  readonly accessTokenAudience: string;
  readonly accessTokenIssuer: string;
  readonly accessTokenSecret: string;
  readonly accessTokenTtlSeconds: number;
  readonly alertWebhookUrl?: string;
  readonly cookieDomain?: string;
  readonly corsOrigins: readonly string[];
  readonly cloudinary?: {
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly cloudName: string;
    readonly folder: string;
  };
  readonly googleOAuth?: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly redirectUri: string;
  };
  readonly host: string;
  readonly email:
    | { readonly provider: "local" }
    | {
        readonly provider: "smtp";
        readonly host: string;
        readonly port: number;
        readonly secure: boolean;
        readonly user: string;
        readonly password: string;
        readonly from: string;
      };
  readonly logLevel: string;
  readonly maxCartQuantity: number;
  readonly mongodbUri: string;
  readonly nodeEnv: "development" | "production" | "test";
  readonly paymentProvider: "mock" | "razorpay";
  readonly phoneAuthEnabled: boolean;
  readonly piiRetentionDays: number;
  readonly productPreviewSecret: string;
  readonly razorpay?: {
    readonly mode: "test" | "live";
    readonly keyId: string;
    readonly keySecret: string;
    readonly webhookSecret: string;
  };
  readonly redisUrl: string;
  readonly socketRedisAdapterEnabled: boolean;
  readonly totpEnabled: boolean;
  readonly trustProxyHops: number;
  readonly port: number;
  readonly webOrigin: string;
  readonly deliveryPostalPrefixes: readonly string[];
}

function parsePayments(
  environment: NodeJS.ProcessEnv,
  nodeEnv: ApiConfig["nodeEnv"],
): Pick<ApiConfig, "paymentProvider" | "razorpay"> {
  const provider =
    environment.PAYMENT_PROVIDER?.trim() || (nodeEnv === "production" ? "razorpay" : "mock");
  if (provider !== "mock" && provider !== "razorpay")
    throw new Error("PAYMENT_PROVIDER must be mock or razorpay.");
  if (nodeEnv === "production" && provider !== "razorpay")
    throw new Error("PAYMENT_PROVIDER must be razorpay in production.");
  if (provider === "mock") return { paymentProvider: "mock" };
  const mode = environment.RAZORPAY_MODE?.trim() || (nodeEnv === "production" ? "live" : "test");
  if (mode !== "test" && mode !== "live") throw new Error("RAZORPAY_MODE must be test or live.");
  if (nodeEnv === "production" && mode !== "live")
    throw new Error("RAZORPAY_MODE must be live in production.");
  const prefix = mode === "live" ? "RAZORPAY_LIVE" : "RAZORPAY_TEST";
  const keyId = environment[`${prefix}_KEY_ID`]?.trim();
  const keySecret = environment[`${prefix}_KEY_SECRET`]?.trim();
  const webhookSecret = environment[`${prefix}_WEBHOOK_SECRET`]?.trim();
  if (!keyId || !keySecret || !webhookSecret)
    throw new Error(
      `${prefix}_KEY_ID, ${prefix}_KEY_SECRET and ${prefix}_WEBHOOK_SECRET are required.`,
    );
  if (!keyId.startsWith(mode === "live" ? "rzp_live_" : "rzp_test_"))
    throw new Error(`${prefix}_KEY_ID does not match RAZORPAY_MODE.`);
  return {
    paymentProvider: "razorpay",
    razorpay: { mode, keyId, keySecret, webhookSecret },
  };
}

function requiredSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  return value;
}

function parseBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${name} must be true or false.`);
}

function parseEmail(
  environment: NodeJS.ProcessEnv,
  nodeEnv: ApiConfig["nodeEnv"],
): ApiConfig["email"] {
  const provider =
    environment.EMAIL_PROVIDER?.trim() || (nodeEnv === "production" ? "smtp" : "local");
  if (provider === "local") {
    if (nodeEnv === "production") throw new Error("EMAIL_PROVIDER must be smtp in production.");
    return { provider: "local" };
  }
  if (provider !== "smtp") throw new Error("EMAIL_PROVIDER must be local or smtp.");
  const host = environment.SMTP_HOST?.trim();
  const user = environment.SMTP_USER?.trim();
  const password = environment.SMTP_PASSWORD?.trim();
  const from = environment.SMTP_FROM?.trim();
  const port = Number(environment.SMTP_PORT);
  if (!host || !user || !password || !from || !Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM are required for SMTP email.",
    );
  return {
    provider: "smtp",
    host,
    port,
    secure: parseBoolean(environment.SMTP_SECURE, "SMTP_SECURE"),
    user,
    password,
    from,
  };
}

function parseGoogleOAuth(environment: NodeJS.ProcessEnv): ApiConfig["googleOAuth"] {
  const values = [
    environment.GOOGLE_CLIENT_ID,
    environment.GOOGLE_CLIENT_SECRET,
    environment.GOOGLE_REDIRECT_URI,
  ];
  if (values.every((value) => !value)) return undefined;
  if (values.some((value) => !value))
    throw new Error(
      "All Google OAuth environment variables are required when Google login is enabled.",
    );
  return { clientId: values[0]!, clientSecret: values[1]!, redirectUri: values[2]! };
}

function parseCloudinary(environment: NodeJS.ProcessEnv): ApiConfig["cloudinary"] {
  const values = [
    environment.CLOUDINARY_CLOUD_NAME,
    environment.CLOUDINARY_API_KEY,
    environment.CLOUDINARY_API_SECRET,
  ];
  if (values.every((value) => !value)) return undefined;
  if (values.some((value) => !value))
    throw new Error(
      "All Cloudinary environment variables are required when media uploads are enabled.",
    );
  return {
    cloudName: values[0]!,
    apiKey: values[1]!,
    apiSecret: values[2]!,
    folder: environment.CLOUDINARY_PRODUCT_FOLDER?.trim() || "thread/products",
  };
}

function parseNodeEnv(value: string | undefined): ApiConfig["nodeEnv"] {
  if (value === undefined || value === "development") return "development";
  if (value === "production" || value === "test") return value;
  throw new Error("NODE_ENV must be development, production, or test.");
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") return 4000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return parsed;
}

function parseMaxQuantity(value: string | undefined): number {
  if (!value) return 10;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50)
    throw new Error("MAX_CART_QUANTITY must be an integer between 1 and 50.");
  return parsed;
}

function parseRetentionDays(value: string | undefined): number {
  if (!value) return 365;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 3_650)
    throw new Error("PII_RETENTION_DAYS must be an integer between 30 and 3650.");
  return parsed;
}

function parseTrustProxyHops(value: string | undefined, nodeEnv: ApiConfig["nodeEnv"]): number {
  if (value === undefined || value === "") return nodeEnv === "production" ? 1 : 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3)
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 3.");
  return parsed;
}

function parseOptionalHttpsUrl(value: string | undefined, name: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use https.`);
  return url.toString();
}

function parseWebOrigin(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error("WEB_ORIGIN is required.");
  }
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("WEB_ORIGIN must use http or https.");
  }
  return url.origin;
}

function parseCorsOrigins(value: string | undefined, webOrigin: string): readonly string[] {
  const origins = (value ?? webOrigin)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
  if (!origins.length) throw new Error("CORS_ORIGINS must contain at least one origin.");
  return [...new Set(origins)];
}

function parseMongoDbUri(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error("MONGODB_URI is required.");
  }
  const protocol = value.split(":", 1)[0];
  if (protocol !== "mongodb" && protocol !== "mongodb+srv") {
    throw new Error("MONGODB_URI must use mongodb or mongodb+srv.");
  }
  return value.trim();
}

function parseRedisUrl(value: string | undefined, nodeEnv: ApiConfig["nodeEnv"]): string {
  const configured = value?.trim() || (nodeEnv === "production" ? "" : "redis://localhost:6379");
  if (!configured) throw new Error("REDIS_URL is required in production.");
  const url = new URL(configured);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:")
    throw new Error("REDIS_URL must use redis or rediss.");
  return configured;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const nodeEnv = parseNodeEnv(environment.NODE_ENV);
  const payments = parsePayments(environment, nodeEnv);
  const email = parseEmail(environment, nodeEnv);
  const webOrigin = parseWebOrigin(environment.WEB_ORIGIN);
  const mongodbUri = parseMongoDbUri(environment.MONGODB_URI);
  const redisUrl = parseRedisUrl(environment.REDIS_URL, nodeEnv);
  if (nodeEnv === "production" && !mongodbUri.startsWith("mongodb+srv://"))
    throw new Error("Production MONGODB_URI must use encrypted mongodb+srv transport.");
  if (nodeEnv === "production" && !redisUrl.startsWith("rediss://"))
    throw new Error("Production REDIS_URL must use encrypted rediss transport.");
  if (nodeEnv === "production" && email.provider === "smtp" && !email.secure)
    throw new Error("Production SMTP must use an encrypted connection (SMTP_SECURE=true).");
  return {
    accessTokenAudience: environment.ACCESS_TOKEN_AUDIENCE?.trim() || "thread-web",
    accessTokenIssuer: environment.ACCESS_TOKEN_ISSUER?.trim() || "thread-api",
    accessTokenSecret: requiredSecret(environment.ACCESS_TOKEN_SECRET, "ACCESS_TOKEN_SECRET"),
    accessTokenTtlSeconds: 15 * 60,
    ...(parseOptionalHttpsUrl(environment.ALERT_WEBHOOK_URL, "ALERT_WEBHOOK_URL")
      ? {
          alertWebhookUrl: parseOptionalHttpsUrl(
            environment.ALERT_WEBHOOK_URL,
            "ALERT_WEBHOOK_URL",
          )!,
        }
      : {}),
    ...(environment.COOKIE_DOMAIN?.trim()
      ? { cookieDomain: environment.COOKIE_DOMAIN.trim() }
      : {}),
    ...(parseCloudinary(environment) ? { cloudinary: parseCloudinary(environment)! } : {}),
    ...(parseGoogleOAuth(environment) ? { googleOAuth: parseGoogleOAuth(environment)! } : {}),
    corsOrigins: parseCorsOrigins(environment.CORS_ORIGINS, webOrigin),
    host: environment.HOST?.trim() || "0.0.0.0",
    email,
    logLevel: environment.LOG_LEVEL?.trim() || "info",
    maxCartQuantity: parseMaxQuantity(environment.MAX_CART_QUANTITY),
    mongodbUri,
    nodeEnv,
    ...payments,
    phoneAuthEnabled: parseBoolean(environment.PHONE_AUTH_ENABLED, "PHONE_AUTH_ENABLED"),
    piiRetentionDays: parseRetentionDays(environment.PII_RETENTION_DAYS),
    productPreviewSecret: requiredSecret(
      environment.PRODUCT_PREVIEW_SECRET,
      "PRODUCT_PREVIEW_SECRET",
    ),
    redisUrl,
    socketRedisAdapterEnabled:
      environment.SOCKET_REDIS_ADAPTER_ENABLED === undefined
        ? nodeEnv === "production"
        : parseBoolean(environment.SOCKET_REDIS_ADAPTER_ENABLED, "SOCKET_REDIS_ADAPTER_ENABLED"),
    totpEnabled: parseBoolean(environment.TOTP_ENABLED, "TOTP_ENABLED"),
    trustProxyHops: parseTrustProxyHops(environment.TRUST_PROXY_HOPS, nodeEnv),
    port: parsePort(environment.PORT),
    webOrigin,
    deliveryPostalPrefixes: (environment.DELIVERY_POSTAL_PREFIXES ?? "")
      .split(",")
      .map((prefix) => prefix.trim())
      .filter((prefix) => /^\d{1,6}$/.test(prefix)),
  };
}
