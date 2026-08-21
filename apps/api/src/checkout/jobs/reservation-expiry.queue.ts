import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";

import type { ReservationExpiryScheduler } from "../checkout.types.js";

interface ReservationExpiryJob {
  sessionId: string;
}
const queueName = "checkout-reservation-expiry";

export class BullMqReservationExpiryQueue implements ReservationExpiryScheduler {
  private producerConnection: Redis | undefined;
  private workerConnection: Redis | undefined;
  private queue: Queue<ReservationExpiryJob> | undefined;
  private worker: Worker<ReservationExpiryJob> | undefined;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
  ) {}

  async start(process: (sessionId: string) => Promise<void>): Promise<void> {
    if (this.queue || this.worker) return;
    this.producerConnection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.workerConnection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await Promise.all([this.producerConnection.connect(), this.workerConnection.connect()]);
    this.queue = new Queue<ReservationExpiryJob>(queueName, {
      connection: this.producerConnection,
      defaultJobOptions: { removeOnComplete: 1_000, removeOnFail: 5_000, attempts: 5 },
    });
    this.worker = new Worker<ReservationExpiryJob>(
      queueName,
      async (job) => process(job.data.sessionId),
      { connection: this.workerConnection, concurrency: 10 },
    );
    this.worker.on("failed", (job, error) =>
      this.logger.error(
        { err: error, jobId: job?.id, sessionId: job?.data.sessionId },
        "Reservation expiry job failed",
      ),
    );
  }

  async schedule(sessionId: string, expiresAt: Date): Promise<void> {
    if (!this.queue) throw new Error("Reservation expiry queue has not started.");
    await this.queue.add(
      "release-reservation",
      { sessionId },
      {
        delay: Math.max(0, expiresAt.getTime() - Date.now()),
        jobId: `release-${sessionId}`,
      },
    );
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await this.workerConnection?.quit();
    await this.producerConnection?.quit();
    this.worker = undefined;
    this.queue = undefined;
    this.workerConnection = undefined;
    this.producerConnection = undefined;
  }
}
