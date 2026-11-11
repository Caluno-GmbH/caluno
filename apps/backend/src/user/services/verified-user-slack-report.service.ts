import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, ilike, not, sql } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { DATABASE_CONNECTION } from '../../database/database-connection';
import * as schema from '../../database/schema';

export const SLACK_REPORTING_WEBHOOK_URL_ENV =
  'SLACK_REPORTING_WEBHOOK_URL' as const;

/** Case-insensitive suffix match for fixture / demo accounts. */
export const CALUNO_ORG_EMAIL_LIKE = '%@caluno.org' as const;

const WEBHOOK_TIMEOUT_MS = 10_000;

export interface VerifiedUserSlackReportSummary {
  verified_user_count: number;
  slack_sent: boolean;
}

export function buildVerifiedUserSlackMessage(count: number): string {
  return `Verified user accounts: ${count}`;
}

/**
 * Counts email-verified users (excluding *@caluno.org) and posts the total to
 * a Slack Incoming Webhook when `SLACK_REPORTING_WEBHOOK_URL` is set.
 */
@Injectable()
export class VerifiedUserSlackReportService {
  private readonly logger = new Logger(VerifiedUserSlackReportService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  async runTick(): Promise<VerifiedUserSlackReportSummary> {
    const verifiedUserCount = await this.countVerifiedUsersExcludingCalunoOrg();
    const webhookUrl = this.configService
      .get<string>(SLACK_REPORTING_WEBHOOK_URL_ENV)
      ?.trim();

    if (!webhookUrl) {
      this.logger.log(
        {
          event: 'verified_user_slack.skipped_no_webhook',
          verified_user_count: verifiedUserCount,
        },
        'SLACK_REPORTING_WEBHOOK_URL unset; skipping Slack post',
      );
      return {
        verified_user_count: verifiedUserCount,
        slack_sent: false,
      };
    }

    await this.postSlackMessage(
      webhookUrl,
      buildVerifiedUserSlackMessage(verifiedUserCount),
    );

    return {
      verified_user_count: verifiedUserCount,
      slack_sent: true,
    };
  }

  async countVerifiedUsersExcludingCalunoOrg(): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.emailVerified, true),
          not(ilike(schema.users.email, CALUNO_ORG_EMAIL_LIKE)),
        ),
      );

    return Number(row?.total ?? 0);
  }

  private async postSlackMessage(url: string, text: string): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Slack webhook responded ${response.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      );
    }
  }
}
