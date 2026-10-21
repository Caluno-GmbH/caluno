import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { maskEmail } from '../../utils';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
}

export interface EmailSendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  userId?: string;
  /** Outbox row id, forwarded to TEM so webhook events can be correlated. */
  emailId?: string;
}

export type EmailSendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; retryable: boolean; error: Error };

interface ScalewayConfig {
  secretKey: string;
  projectId: string;
  region: string;
  fromEmail: string;
  fromName?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  fromEmail: string;
  fromName?: string;
}

const SEND_TIMEOUT_MS = 20_000;

function summarize(text: string, maxLength = 300): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength)}…`
    : collapsed;
}

/**
 * One delivery attempt against the configured provider. Retry policy lives in
 * EmailOutboxService, which owns the durable row.
 */
@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);
  private readonly scaleway: ScalewayConfig | null = null;
  private readonly smtp: SmtpConfig | null = null;
  private readonly transporter: nodemailer.Transporter | null = null;
  /**
   * Dev fallback: when no mailer is configured, emails are logged instead of
   * sent. The full HTML (recipient names, OTPs, reset links) is only included
   * when explicitly enabled outside production/staging.
   */
  private readonly logEmailContent =
    process.env.EMAIL_LOG_CONTENT === '1' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'staging';

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('TEM_SECRET_KEY');
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT');

    if (secretKey) {
      this.scaleway = {
        secretKey,
        projectId: this.configService.getOrThrow<string>('PROJECT_ID'),
        region: this.configService.getOrThrow<string>('TEM_REGION'),
        fromEmail: 'noreply@caluno.org',
        fromName: 'Caluno',
      };
    } else if (smtpHost && smtpPort) {
      this.smtp = {
        host: smtpHost,
        port: Number.parseInt(smtpPort, 10),
        fromEmail: 'noreply@caluno.org',
        fromName: 'Caluno',
      };
      this.transporter = nodemailer.createTransport({
        host: this.smtp.host,
        port: this.smtp.port,
        ignoreTLS: true,
      });
    }
  }

  async sendOnce(options: EmailSendOptions): Promise<EmailSendResult> {
    const maskedTo = maskEmail(options.to);

    if (this.transporter && this.smtp) {
      try {
        const info = await this.transporter.sendMail({
          from: `"${this.smtp.fromName}" <${this.smtp.fromEmail}>`,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text ?? this.htmlToText(options.html),
          attachments: options.attachments?.map((attachment) => ({
            ...attachment,
            contentDisposition: attachment.cid ? 'inline' : 'attachment',
          })),
        });
        this.logger.debug(`Email sent to ${maskedTo} via SMTP`);
        return { ok: true, providerMessageId: info.messageId ?? null };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const responseCode = (error as { responseCode?: number } | null)
          ?.responseCode;
        // 4xx SMTP replies are transient; 5xx are permanent. Network errors
        // (no code) are worth retrying.
        const retryable =
          responseCode === undefined ||
          responseCode === 429 ||
          (responseCode >= 400 && responseCode < 500);
        return {
          ok: false,
          retryable,
          error: new Error(
            `Failed to send email to ${options.userId}:${maskedTo} via SMTP: ${summarize(message)}`,
            { cause: error },
          ),
        };
      }
    }

    if (!this.scaleway) {
      const attachmentNote = options.attachments?.length
        ? ` attachments=${options.attachments.map((a) => a.filename).join(',')}`
        : '';
      this.logger.log(
        `[Email:LOG] to=${maskedTo} subject="${options.subject}"${attachmentNote}${
          this.logEmailContent
            ? `\n${options.html}`
            : ' (content omitted; set EMAIL_LOG_CONTENT=1 outside production to log)'
        }`,
      );
      return { ok: true, providerMessageId: null };
    }

    return this.sendViaScaleway(this.scaleway, options, maskedTo);
  }

  private async sendViaScaleway(
    config: ScalewayConfig,
    options: EmailSendOptions,
    maskedTo: string,
  ): Promise<EmailSendResult> {
    const url = `https://api.scaleway.com/transactional-email/v1alpha1/regions/${config.region}/emails`;

    const body = JSON.stringify({
      from: {
        email: config.fromEmail,
        name: config.fromName,
      },
      to: [{ email: options.to }],
      subject: options.subject,
      html: options.html,
      text: options.text ?? this.htmlToText(options.html),
      project_id: config.projectId,
      additional_headers: options.emailId
        ? [{ key: 'X-Caluno-Email-Id', value: options.emailId }]
        : undefined,
      attachments: options.attachments?.map((attachment) => ({
        name: attachment.filename,
        type: attachment.contentType,
        content: attachment.content.toString('base64'),
        ...(attachment.cid ? { content_id: attachment.cid } : {}),
      })),
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': config.secretKey,
        },
        body,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        // A timeout is ambiguous (the request may already have been accepted),
        // but leaving it queued is still better than dropping the email. The
        // outbox id header lets a later reconciliation recognise duplicates.
        retryable: true,
        error: new Error(
          `Failed to send email to ${options.userId}:${maskedTo}: ${summarize(message)}`,
          { cause: error },
        ),
      };
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        error: new Error(
          `Failed to send email to ${options.userId}:${maskedTo}: Scaleway responded ${response.status}${
            responseBody ? ` — ${summarize(responseBody)}` : ''
          }`,
        ),
      };
    }

    return {
      ok: true,
      providerMessageId: await this.readProviderMessageId(response),
    };
  }

  private async readProviderMessageId(
    response: Response,
  ): Promise<string | null> {
    try {
      const payload = (await response.json()) as {
        id?: string;
        email?: { id?: string };
      } | null;
      return payload?.id ?? payload?.email?.id ?? null;
    } catch {
      return null;
    }
  }

  private htmlToText(html: string): string {
    let sanitized = html;
    let previous: string;

    do {
      previous = sanitized;
      sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    } while (sanitized !== previous);

    return sanitized
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
