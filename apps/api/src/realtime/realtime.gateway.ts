import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";

import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Types } from "mongoose";
import type { Logger } from "pino";
import { Server } from "socket.io";
import type {
  AdminDashboardUpdatedEvent,
  ClientToServerEvents,
  InventoryUpdatedEvent,
  NotificationCreatedEvent,
  OrderCreatedEvent,
  OrderStatusUpdatedEvent,
  PaymentUpdatedEvent,
  RealtimeRoom,
  ServerToClientEvents,
  UserRole,
} from "@thread/types";

import type { AccessTokenClaims } from "../auth/auth.types.js";
import type { AccessTokenService } from "../auth/security/tokens.js";
import { OrderModel } from "../checkout/models/order.model.js";

interface SocketData {
  userId: string;
  roles: readonly UserRole[];
}

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export async function authorizeRealtimeRoom(
  claims: Pick<AccessTokenClaims, "subject" | "roles">,
  room: RealtimeRoom,
  ownsOrder: (orderId: string, userId: string) => Promise<boolean>,
): Promise<boolean> {
  if (room.startsWith("user:")) return room === `user:${claims.subject}`;
  if (room === "role:admin")
    return claims.roles.some((role) =>
      ["super_admin", "admin", "catalog_manager", "order_manager", "support_agent"].includes(role),
    );
  if (room === "role:order_manager")
    return claims.roles.some((role) => ["super_admin", "admin", "order_manager"].includes(role));
  if (room.startsWith("order:")) {
    const orderId = room.slice("order:".length);
    if (!Types.ObjectId.isValid(orderId)) return false;
    if (claims.roles.some((role) => ["super_admin", "admin", "order_manager"].includes(role)))
      return true;
    return ownsOrder(orderId, claims.subject);
  }
  return false;
}

export class RealtimeGateway {
  private io: TypedServer | undefined;
  private publisherRedis: Redis | undefined;
  private subscriberRedis: Redis | undefined;

  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly logger: Logger,
    private readonly options: {
      readonly webOrigin: string;
      readonly redisUrl: string;
      readonly redisAdapterEnabled: boolean;
    },
  ) {}

  async attach(server: HttpServer): Promise<void> {
    if (this.io) return;
    const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(server, {
      cors: { origin: this.options.webOrigin, credentials: true },
      transports: ["websocket", "polling"],
      serveClient: false,
    });
    if (this.options.redisAdapterEnabled) {
      this.publisherRedis = new Redis(this.options.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      this.subscriberRedis = this.publisherRedis.duplicate();
      await Promise.all([this.publisherRedis.connect(), this.subscriberRedis.connect()]);
      io.adapter(createAdapter(this.publisherRedis, this.subscriberRedis));
    }
    io.use(async (socket, next) => {
      const token =
        typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      if (!token) return next(new Error("Authentication required."));
      try {
        const claims = await this.accessTokens.verify(token);
        socket.data = { userId: claims.subject, roles: claims.roles };
        next();
      } catch {
        next(new Error("Authentication required."));
      }
    });
    io.on("connection", (socket) => {
      const claims: AccessTokenClaims = {
        subject: socket.data.userId,
        roles: socket.data.roles,
        sessionFamilyId: "",
      };
      void socket.join(`user:${socket.data.userId}`);
      if (
        socket.data.roles.some((role) =>
          ["super_admin", "admin", "catalog_manager", "order_manager", "support_agent"].includes(
            role,
          ),
        )
      )
        void socket.join("role:admin");
      if (
        socket.data.roles.some((role) => ["super_admin", "admin", "order_manager"].includes(role))
      )
        void socket.join("role:order_manager");
      socket.on("room.join", async (room, acknowledge) => {
        let permitted = false;
        try {
          permitted = await authorizeRealtimeRoom(claims, room, async (orderId, userId) =>
            Boolean(await OrderModel.exists({ _id: orderId, userId })),
          );
        } catch {
          permitted = false;
        }
        if (!permitted) {
          acknowledge({ ok: false, error: "Room access denied." });
          return;
        }
        await socket.join(room);
        acknowledge({ ok: true });
      });
    });
    this.io = io;
    this.logger.info(
      { redisAdapterEnabled: this.options.redisAdapterEnabled },
      "Realtime gateway attached",
    );
  }

  emitOrderCreated(
    userId: string,
    event: Omit<OrderCreatedEvent, keyof RealtimeEventFields>,
  ): void {
    const payload = withMeta(event);
    this.io?.to(`user:${userId}`).to(`order:${event.orderId}`).emit("order.created", payload);
    this.io?.to("role:admin").emit("order.created", payload);
  }

  emitOrderStatus(
    userId: string,
    event: Omit<OrderStatusUpdatedEvent, keyof RealtimeEventFields>,
  ): void {
    const payload = withMeta(event);
    this.io
      ?.to(`user:${userId}`)
      .to(`order:${event.orderId}`)
      .emit("order.status.updated", payload);
    this.io?.to("role:admin").emit("order.status.updated", payload);
  }

  emitPayment(userId: string, event: Omit<PaymentUpdatedEvent, keyof RealtimeEventFields>): void {
    const payload = withMeta(event);
    this.io?.to(`user:${userId}`).to(`order:${event.orderId}`).emit("payment.updated", payload);
    this.io?.to("role:admin").emit("payment.updated", payload);
  }

  emitInventory(event: Omit<InventoryUpdatedEvent, keyof RealtimeEventFields>): void {
    this.io?.to("role:admin").emit("inventory.updated", withMeta(event));
  }

  emitNotification(
    userId: string,
    event: Omit<NotificationCreatedEvent, keyof RealtimeEventFields>,
  ): void {
    this.io?.to(`user:${userId}`).emit("notification.created", withMeta(event));
  }

  emitAdmin(event: Omit<AdminDashboardUpdatedEvent, keyof RealtimeEventFields>): void {
    this.io?.to("role:admin").emit("admin.dashboard.updated", withMeta(event));
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.io) return resolve();
      this.io.close(() => resolve());
    });
    await Promise.all([this.publisherRedis?.quit(), this.subscriberRedis?.quit()]);
    this.io = undefined;
    this.publisherRedis = undefined;
    this.subscriberRedis = undefined;
  }
}

type RealtimeEventFields = { eventId: string; occurredAt: string };

function withMeta<T extends object>(event: T): T & RealtimeEventFields {
  return { ...event, eventId: randomUUID(), occurredAt: new Date().toISOString() };
}
