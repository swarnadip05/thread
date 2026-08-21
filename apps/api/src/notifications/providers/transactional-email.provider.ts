import type { Logger } from "pino";
import nodemailer, { type Transporter } from "nodemailer";

export interface TransactionalEmail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly attachments?: readonly {
    readonly filename: string;
    readonly content: Buffer;
    readonly contentType: string;
  }[];
}

export interface TransactionalEmailProvider {
  send(message: TransactionalEmail): Promise<void>;
}

export class LocalLogEmailProvider implements TransactionalEmailProvider {
  constructor(private readonly logger: Logger) {}

  async send(message: TransactionalEmail): Promise<void> {
    await Promise.resolve();
    this.logger.info(
      {
        attachmentCount: message.attachments?.length ?? 0,
        developmentBody: message.text,
        subject: message.subject,
        to: message.to,
      },
      "Local transactional email accepted",
    );
  }
}

export class SmtpEmailProvider implements TransactionalEmailProvider {
  private transporter: Transporter | undefined;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: string;
    },
  ) {}

  async send(message: TransactionalEmail): Promise<void> {
    if (!this.transporter)
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: { user: this.config.user, pass: this.config.password },
      });
    await this.transporter.sendMail({
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.attachments ? { attachments: [...message.attachments] } : {}),
    });
  }
}
