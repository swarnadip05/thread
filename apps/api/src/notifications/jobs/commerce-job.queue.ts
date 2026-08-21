import { createHash } from "node:crypto";

import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";
import type { CommerceJobName } from "@thread/types";

import type { ReservationExpiryScheduler } from "../../checkout/checkout.types.js";

export type CommerceJob =
  | {
      name: "reservation.release";
      key: string;
      payload: { sessionId: string };
    }
  | {
      name: "email.order-confirmation" | "email.order-status" | "invoice.generate";
      key: string;
      payload: { orderId: string };
    }
  | {
      name: "email.password" | "email.verification";
      key: string;
      payload: { email: string; name: string; token: string };
    }
  | {
      name: "email.newsletter-confirmation";
      key: string;
      payload: { email: string };
    }
  | {
      name: "inventory.low-stock";
      key: string;
      payload: { variantId: string };
    };

const queueName = "thread-commerce-jobs";
const deadLetterQueueName = "thread-commerce-dead-letter";

export function commerceJobId(key: string): string {
  return `job-${createHash("sha256").update(key).digest("hex")}`;
}

export class CommerceJobQueue implements ReservationExpiryScheduler {
  private producerConnection: Redis | undefined;
  private workerConnection: Redis | undefined;
  private queue: Queue<CommerceJob> | undefined;
  private deadLetterQueue:
    | Queue<{
        originalJobId?: string;
        jobName: CommerceJobName;
        key: string;
        failedAt: string;
      }>
    | undefined;
  private worker: Worker<CommerceJob> | undefined;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
  ) {}

  async startProducer(): Promise<void> {
    if (this.queue) return;
    this.producerConnection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await this.producerConnection.connect();
    this.queue = new Queue<CommerceJob>(queueName, {
      connection: this.producerConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 5_000,
        removeOnFail: 10_000,
      },
    });
  }

  async startWorker(process: (job: CommerceJob) => Promise<void>): Promise<void> {
    if (this.worker) return;
    await this.startProducer();
    this.workerConnection = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    await this.workerConnection.connect();
    this.deadLetterQueue = new Queue(deadLetterQueueName, {
      connection: this.producerConnection!,
      defaultJobOptions: { removeOnComplete: 10_000, removeOnFail: 10_000 },
    });
    this.worker = new Worker<CommerceJob>(queueName, async (job) => process(job.data), {
      connection: this.workerConnection,
      concurrency: 10,
    });
    this.worker.on("failed", (job, error) => void this.failed(job, error));
  }

  async enqueue(job: CommerceJob, options: { delay?: number } = {}): Promise<void> {
    if (!this.queue) throw new Error("Commerce job queue has not started.");
    await this.queue.add(job.name, job, {
      jobId: commerceJobId(job.key),
      ...(options.delay ? { delay: options.delay } : {}),
    });
  }

  async isReady(): Promise<boolean> {
    try {
      return (await this.producerConnection?.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  schedule(sessionId: string, expiresAt: Date): Promise<void> {
    return this.enqueue(
      {
        name: "reservation.release",
        key: `reservation.release:${sessionId}`,
        payload: { sessionId },
      },
      { delay: Math.max(0, expiresAt.getTime() - Date.now()) },
    );
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.deadLetterQueue?.close();
    await this.queue?.close();
    await this.workerConnection?.quit();
    await this.producerConnection?.quit();
    this.worker = undefined;
    this.deadLetterQueue = undefined;
    this.queue = undefined;
    this.workerConnection = undefined;
    this.producerConnection = undefined;
  }

  private async failed(job: Job<CommerceJob> | undefined, error: Error): Promise<void> {
    const attempts = job?.opts.attempts ?? 1;
    const exhausted = Boolean(job && job.attemptsMade >= attempts);
    this.logger.error(
      {
        err: error,
        jobId: job?.id,
        jobName: job?.data.name,
        exhausted,
      },
      "Commerce background job failed",
    );
    if (!job || !exhausted || !this.deadLetterQueue) return;
    await this.deadLetterQueue.add(
      "dead-letter",
      {
        ...(job.id ? { originalJobId: job.id } : {}),
        jobName: job.data.name,
        key: job.data.key,
        failedAt: new Date().toISOString(),
      },
      { jobId: `dead-${commerceJobId(job.data.key)}` },
    );
  }
}
