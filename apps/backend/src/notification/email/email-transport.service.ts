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

@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);
  private readonly scaleway: ScalewayConfig | null = null;
  private readonly smtp: SmtpConfig | null = null;
  private readonly transporter: nodemailer.Transporter | null = null;
  // Logged bodies contain OTPs and reset links, so they are opt-in and never
  // logged in production or staging.
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

  async sendOnce(email: EmailSendOptions): Promise<EmailSendResult> {
    const maskedTo = maskEmail(email.to);

    if (this.transporter && this.smtp) {
      try {
        const sendInfo = await this.transporter.sendMail({
          from: `"${this.smtp.fromName}" <${this.smtp.fromEmail}>`,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text ?? this.htmlToText(email.html),
          attachments: email.attachments?.map((attachment) => ({
            ...attachment,
            contentDisposition: attachment.cid ? 'inline' : 'attachment',
          })),
        });
        this.logger.debug(`Email sent to ${maskedTo} via SMTP`);
        return {
          ok: true,
          providerMessageId: sendInfo.messageId ?? null,
        };
      } catch (sendError) {
        const errorMessage =
          sendError instanceof Error ? sendError.message : String(sendError);
        const responseCode = (sendError as { responseCode?: number } | null)
          ?.responseCode;
        // SMTP 4xx replies are transient and 5xx are permanent (the reverse of
        // HTTP). Network errors have no code and are worth retrying.
        const retryable =
          responseCode === undefined ||
          responseCode === 429 ||
          (responseCode >= 400 && responseCode < 500);
        return {
          ok: false,
          retryable,
          error: new Error(
            `Failed to send email to ${email.userId}:${maskedTo} via SMTP: ${summarize(errorMessage)}`,
            { cause: sendError },
          ),
        };
      }
    }

    if (!this.scaleway) {
      const attachmentNote = email.attachments?.length
        ? ` attachments=${email.attachments.map((a) => a.filename).join(',')}`
        : '';
      this.logger.log(
        `[Email:LOG] to=${maskedTo} subject="${email.subject}"${attachmentNote}${
          this.logEmailContent
            ? `\n${email.html}`
            : ' (content omitted; set EMAIL_LOG_CONTENT=1 outside production to log)'
        }`,
      );
      return { ok: true, providerMessageId: null };
    }

    return this.sendViaScaleway(this.scaleway, email, maskedTo);
  }

  private async sendViaScaleway(
    scalewayConfig: ScalewayConfig,
    email: EmailSendOptions,
    maskedTo: string,
  ): Promise<EmailSendResult> {
    const url = `https://api.scaleway.com/transactional-email/v1alpha1/regions/${scalewayConfig.region}/emails`;

    const requestBody = JSON.stringify({
      from: {
        email: scalewayConfig.fromEmail,
        name: scalewayConfig.fromName,
      },
      to: [{ email: email.to }],
      subject: email.subject,
      html: email.html,
      text: email.text ?? this.htmlToText(email.html),
      project_id: scalewayConfig.projectId,
      additional_headers: email.emailId
        ? [{ key: 'X-Caluno-Email-Id', value: email.emailId }]
        : undefined,
      attachments: email.attachments?.map((attachment) => ({
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
          'X-Auth-Token': scalewayConfig.secretKey,
        },
        body: requestBody,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (sendError) {
      const errorMessage =
        sendError instanceof Error ? sendError.message : String(sendError);
      return {
        ok: false,
        // A timeout is ambiguous (the provider may already have accepted it),
        // but retrying beats dropping the email. The X-Caluno-Email-Id header
        // lets duplicates be recognised later.
        retryable: true,
        error: new Error(
          `Failed to send email to ${email.userId}:${maskedTo}: ${summarize(errorMessage)}`,
          { cause: sendError },
        ),
      };
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        error: new Error(
          `Failed to send email to ${email.userId}:${maskedTo}: Scaleway responded ${response.status}${
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
