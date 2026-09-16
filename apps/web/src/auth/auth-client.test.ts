import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  vi.resetModules();
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

describe("auth API configuration", () => {
  it("uses the configured local API origin", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
    const { API_URL } = await import("./auth-client");
    expect(API_URL).toBe("http://localhost:4000");
  });

  it("normalizes legacy configuration that included the route prefix", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000/api/v1/";
    const { API_URL } = await import("./auth-client");
    expect(API_URL).toBe("http://localhost:4000");
  });

  it("throws friendly ApiClientError on 404 HTML responses instead of crashing with JSON syntax error", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
    const { authRequest, ApiClientError } = await import("./auth-client");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: () => Promise.resolve("<!DOCTYPE html><html><body>404 Not Found</body></html>"),
    } as unknown as Response);

    try {
      await expect(authRequest("/login")).rejects.toThrow(ApiClientError);
      await expect(authRequest("/login")).rejects.toThrow(/unreachable \(404 Not Found\)/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
