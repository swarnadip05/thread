import type { ApiResponse, AuthSessionDto } from "@thread/types";

const environmentApiUrl = process.env.NEXT_PUBLIC_API_URL;
const configuredApiUrl = (
  process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(environmentApiUrl ?? "")
    ? ""
    : environmentApiUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000")
).replace(/\/+$/, "");

// NEXT_PUBLIC_API_URL is the API origin. Keep older local files that included
// `/api/v1` from duplicating the route prefix while they are being migrated.
export const API_URL = configuredApiUrl.replace(/\/api\/v1$/, "");
const environmentSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
export const SOCKET_URL =
  process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(environmentSocketUrl ?? "")
    ? API_URL
    : environmentSocketUrl || API_URL;

function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("thread_csrf="))
    ?.split("=", 2)[1];
  return value ? decodeURIComponent(value) : "";
}

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1/auth${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(csrfToken() ? { "x-csrf-token": csrfToken() } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    const error = body.success
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;
    throw new ApiClientError(error.code, error.message, response.status);
  }
  return body.data;
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      ...(csrfToken() ? { "x-csrf-token": csrfToken() } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !body.success) {
    const error = body.success
      ? { code: "REQUEST_FAILED", message: "Request failed." }
      : body.error;
    throw new ApiClientError(error.code, error.message, response.status);
  }
  return body.data;
}

export function refreshSession(): Promise<AuthSessionDto> {
  return authRequest<AuthSessionDto>("/refresh", { method: "POST" });
}

export async function downloadApiFile(path: string, accessToken: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    credentials: "include",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok)
    throw new ApiClientError("DOWNLOAD_FAILED", "Download failed.", response.status);
  return response.blob();
}
