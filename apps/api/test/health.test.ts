import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";

const silentLogger = pino({ enabled: false });

describe("health endpoints", () => {
  it("reports the process as live and returns a request ID", async () => {
    const app = createApp({
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });

    const response = await request(app).get("/health/live").expect(200);

    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "live", service: "thread-api" },
    });
  });

  it("reports not-ready with a 503 response", async () => {
    const app = createApp({
      isReady: () => false,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });

    const response = await request(app).get("/health/ready").expect(503);
    expect(response.body.data.status).toBe("not-ready");
  });

  it("preserves a valid caller-provided request ID", async () => {
    const app = createApp({
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });

    const response = await request(app)
      .get("/health/ready")
      .set("x-request-id", "health-test-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("health-test-123");
    expect(response.body.data.requestId).toBe("health-test-123");
  });

  it("sets reviewed API security headers", async () => {
    const app = createApp({
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    const response = await request(app).get("/health/live").expect(200);
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("allows only exact configured CORS origins", async () => {
    const app = createApp({
      corsOrigins: ["https://shop.example"],
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "https://shop.example",
    });
    await request(app)
      .get("/health/live")
      .set("origin", "https://shop.example")
      .expect("access-control-allow-origin", "https://shop.example")
      .expect(200);
    const denied = await request(app)
      .get("/health/live")
      .set("origin", "https://evil.example")
      .expect(403);
    expect(denied.body.error.code).toBe("CORS_ORIGIN_REJECTED");
  });

  it("rejects non-JSON request bodies and unsafe query keys", async () => {
    const app = createApp({
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    const contentType = await request(app)
      .post("/api/v1/not-a-route")
      .set("content-type", "text/plain")
      .send("hello")
      .expect(415);
    expect(contentType.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const injection = await request(app)
      .get("/api/v1/not-a-route?__proto__[polluted]=true")
      .expect(400);
    expect(injection.body.error.code).toBe("UNSAFE_INPUT");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("reports dependency names without connection details", async () => {
    const app = createApp({
      dependencyStatus: async () => ({ database: true, queue: false }),
      isReady: () => true,
      logger: silentLogger,
      webOrigin: "http://localhost:3000",
    });
    const response = await request(app).get("/health/ready").expect(503);
    expect(response.body.data.dependencies).toEqual({ database: "up", queue: "down" });
    expect(JSON.stringify(response.body)).not.toContain("mongodb://");
    expect(JSON.stringify(response.body)).not.toContain("redis://");
  });
});
