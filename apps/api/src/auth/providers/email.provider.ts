import type { Logger } from "pino";

export interface EmailProvider {
  sendPasswordReset(input: { email: string; name: string; token: string }): Promise<void>;
  sendVerification(input: { email: string; name: string; token: string }): Promise<void>;
}

export class DevelopmentEmailProvider implements EmailProvider {
  constructor(private readonly logger: Logger) {}
  async sendPasswordReset(input: { email: string; name: string; token: string }): Promise<void> {
    this.logger.info(
      { email: input.email, developmentToken: input.token, purpose: "password-reset" },
      "Development email token generated",
    );
  }
  async sendVerification(input: { email: string; name: string; token: string }): Promise<void> {
    this.logger.info(
      { email: input.email, developmentToken: input.token, purpose: "email-verification" },
      "Development email token generated",
    );
  }
}

export class UnconfiguredEmailProvider implements EmailProvider {
  async sendPasswordReset(): Promise<void> {
    throw new Error("Production email provider is not configured.");
  }
  async sendVerification(): Promise<void> {
    throw new Error("Production email provider is not configured.");
  }
}
