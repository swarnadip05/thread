import { createServer } from "node:http";

import pino from "pino";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import type {
  ClientToServerEvents,
  PaymentUpdatedEvent,
  ServerToClientEvents,
  UserRole,
} from "@thread/types";

import type { AccessTokenClaims } from "../src/auth/auth.types.js";
import type { AccessTokenService } from "../src/auth/security/tokens.js";
import { commerceJobId } from "../src/notifications/jobs/commerce-job.queue.js";
import { authorizeRealtimeRoom, RealtimeGateway } from "../src/realtime/realtime.gateway.js";

class TestAccessTokens implements AccessTokenService {
  async issue(): Promise<string> {
    return "unused";
  }
  async verify(token: string): Promise<AccessTokenClaims> {
    const [subject, rolesValue = "customer"] = token.split("|");
    if (!subject) throw new Error("Invalid token");
    return {
      subject,
      roles: rolesValue.split(",") as UserRole[],
      sessionFamilyId: `session-${subject}`,
    };
  }
}

type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: TestSocket[] = [];
const gateways: RealtimeGateway[] = [];
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  clients.forEach((client) => client.disconnect());
  await Promise.all(gateways.map((gateway) => gateway.close()));
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) return resolve();
          server.close(() => resolve());
        }),
    ),
  );
  clients.length = 0;
  gateways.length = 0;
  servers.length = 0;
});

async function setup() {
  const server = createServer((_request, response) => response.end("ok"));
  servers.push(server);
  const gateway = new RealtimeGateway(new TestAccessTokens(), pino({ level: "silent" }), {
    webOrigin: "http://localhost:3000",
    redisUrl: "redis://localhost:6379",
    redisAdapterEnabled: false,
  });
  gateways.push(gateway);
  await gateway.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  return { gateway, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string, token: string): Promise<TestSocket> {
  return new Promise((resolve, reject) => {
    const client: TestSocket = io(url, {
      auth: { token },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    clients.push(client);
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

describe("realtime authorization", () => {
  it("rejects unauthorized role and foreign user rooms", async () => {
    const claims = { subject: "user-a", roles: ["customer"] as const };
    await expect(authorizeRealtimeRoom(claims, "role:admin", async () => false)).resolves.toBe(
      false,
    );
    await expect(authorizeRealtimeRoom(claims, "user:user-b", async () => false)).resolves.toBe(
      false,
    );
  });

  it("isolates user events and restores the user room after reconnect", async () => {
    const { gateway, url } = await setup();
    const userA = await connect(url, "user-a|customer");
    const userB = await connect(url, "user-b|customer");
    let userBReceived = false;
    userB.on("payment.updated", () => {
      userBReceived = true;
    });
    const first = new Promise<PaymentUpdatedEvent>((resolve) =>
      userA.once("payment.updated", resolve),
    );
    gateway.emitPayment("user-a", {
      orderId: "order-a",
      status: "captured",
    });
    expect((await first).orderId).toBe("order-a");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(userBReceived).toBe(false);

    userA.disconnect();
    await new Promise<void>((resolve, reject) => {
      userA.once("connect", () => resolve());
      userA.once("connect_error", reject);
      userA.connect();
    });
    const afterReconnect = new Promise<PaymentUpdatedEvent>((resolve) =>
      userA.once("payment.updated", resolve),
    );
    gateway.emitPayment("user-a", {
      orderId: "order-after-reconnect",
      status: "captured",
    });
    expect((await afterReconnect).orderId).toBe("order-after-reconnect");
  });
});

describe("job idempotency keys", () => {
  it("maps duplicate business keys to the same BullMQ job ID", () => {
    expect(commerceJobId("email.order-confirmation:order-a")).toBe(
      commerceJobId("email.order-confirmation:order-a"),
    );
    expect(commerceJobId("email.order-confirmation:order-a")).not.toBe(
      commerceJobId("email.order-confirmation:order-b"),
    );
  });
});
