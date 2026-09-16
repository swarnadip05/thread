/**
 * The one public API origin used by both server and client storefront code.
 *
 * `NEXT_PUBLIC_*` values are embedded at build time by Next.js. Production
 * deployments must therefore provide the API's HTTPS origin during the build;
 * localhost is intentionally never accepted in a production bundle.
 */
function normalizeApiOrigin(value: string | undefined): string {
  const normalized = value?.trim().replace(/\/+$/, "") ?? "";
  if (!normalized) {
    if (typeof window !== "undefined") return "";
    return (
      process.env.BACKEND_API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://thread-sfe5.onrender.com"
        : "http://localhost:4000")
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    /(^|\/\/)(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(normalized)
  ) {
    return typeof window !== "undefined"
      ? ""
      : (process.env.BACKEND_API_URL || "https://thread-sfe5.onrender.com");
  }
  // Older local environment files occasionally included the REST prefix.
  return normalized.replace(/\/api\/v1$/, "");
}

export const API_URL = normalizeApiOrigin(
  process.env.NEXT_PUBLIC_API_URL ||
    (typeof window === "undefined" ? process.env.BACKEND_API_URL : undefined),
);

/**
 * Emergency snapshots are deliberately opt-in. They must never mask a local
 * API/database failure, otherwise an administrator cannot verify catalogue
 * writes against the live source of truth.
 */
export const USE_STATIC_CATALOGUE = process.env.NEXT_PUBLIC_USE_STATIC_CATALOGUE === "true";

export const catalogueUnavailableMessage =
  process.env.NODE_ENV === "development"
    ? "The live catalogue API at http://localhost:4000 is unavailable. Start the API and check /api/v1/health."
    : "The live catalogue service is temporarily unavailable. Please try again shortly.";
