import type { ApiResponse, AuthSessionDto } from "@thread/types";
import { API_URL as configuredApiUrl } from "@/config/api-url";

// Re-export the shared API origin so existing auth consumers retain their API.
export const API_URL = configuredApiUrl;
const environmentSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
export const SOCKET_URL =
  process.env.NODE_ENV === "production" &&
  (!environmentSocketUrl || /(^|\/\/)(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(environmentSocketUrl))
    ? "https://thread-sfe5.onrender.com"
    : environmentSocketUrl || (process.env.NODE_ENV === "production" ? "https://thread-sfe5.onrender.com" : "http://localhost:4000");

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

async function parseApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (response.status === 404) {
      throw new ApiClientError(
        "SERVICE_UNAVAILABLE",
        "The API service is unreachable (404 Not Found). Please verify your backend server deployment and BACKEND_API_URL settings.",
        404,
      );
    }
    if (response.status >= 500) {
      throw new ApiClientError(
        "SERVER_ERROR",
        "The server is temporarily unavailable. Please try again shortly.",
        response.status,
      );
    }
    throw new ApiClientError(
      "INVALID_RESPONSE",
      `Unexpected response from server (${response.status}).`,
      response.status,
    );
  }
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      "INVALID_JSON",
      "Unable to parse server response as JSON.",
      response.status,
    );
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
  const body = await parseApiResponse<T>(response);
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
  const body = await parseApiResponse<T>(response);
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
