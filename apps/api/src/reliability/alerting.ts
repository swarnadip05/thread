import type { Logger } from "pino";

export interface AlertingHook {
  notify(input: {
    code: string;
    message: string;
    severity: "warning" | "critical";
    count?: number;
  }): Promise<void>;
}

export class LogAndWebhookAlertingHook implements AlertingHook {
  constructor(
    private readonly logger: Logger,
    private readonly webhookUrl?: string,
  ) {}

  async notify(input: {
    code: string;
    message: string;
    severity: "warning" | "critical";
    count?: number;
  }): Promise<void> {
    this.logger[input.severity === "critical" ? "error" : "warn"](
      { alertCode: input.code, count: input.count },
      input.message,
    );
    if (!this.webhookUrl) return;
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      this.logger.warn(
        { alertCode: input.code, status: response.status },
        "Alert webhook rejected notification",
      );
  }
}
