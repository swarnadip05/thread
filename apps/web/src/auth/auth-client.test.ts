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
});
