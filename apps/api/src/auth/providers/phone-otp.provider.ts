import type { Logger } from "pino";

export interface PhoneOtpProvider {
  deliver(phone: string, code: string): Promise<void>;
}

export class DevelopmentPhoneOtpProvider implements PhoneOtpProvider {
  constructor(private readonly logger: Logger) {}
  async deliver(phone: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production")
      throw new Error("Development OTP provider cannot run in production.");
    this.logger.info({ developmentOtp: code, phone }, "Development phone OTP generated");
  }
}

export class ApprovedSmsProviderStub implements PhoneOtpProvider {
  async deliver(): Promise<void> {
    throw new Error("An approved production SMS provider must be configured.");
  }
}
