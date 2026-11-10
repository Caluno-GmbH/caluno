import { afterEach, describe, expect, it, mock } from 'bun:test';
import { and, eq, ilike, not } from 'drizzle-orm';
import * as schema from '../../database/schema';
import {
  buildVerifiedUserSlackMessage,
  CALUNO_ORG_EMAIL_LIKE,
  SLACK_REPORTING_WEBHOOK_URL_ENV,
  VerifiedUserSlackReportService,
} from './verified-user-slack-report.service';

describe('buildVerifiedUserSlackMessage', () => {
  it('formats the approved Slack text', () => {
    expect(buildVerifiedUserSlackMessage(42)).toBe(
      'Verified user accounts: 42',
    );
  });
});

describe('VerifiedUserSlackReportService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function build(options: { count?: number; webhookUrl?: string | undefined }) {
    let capturedWhere: unknown;

    const db = {
      select: () => ({
        from: () => ({
          where: async (whereClause: unknown) => {
            capturedWhere = whereClause;
            return [{ total: options.count ?? 0 }];
          },
        }),
      }),
    };

    const configService = {
      get: (key: string) =>
        key === SLACK_REPORTING_WEBHOOK_URL_ENV
          ? options.webhookUrl
          : undefined,
    };

    const service = new VerifiedUserSlackReportService(
      db as never,
      configService as never,
    );

    return { service, getCapturedWhere: () => capturedWhere };
  }

  it('counts only verified users outside *@caluno.org', async () => {
    const { service, getCapturedWhere } = build({
      count: 7,
      webhookUrl: undefined,
    });

    const summary = await service.runTick();

    expect(summary).toEqual({
      verified_user_count: 7,
      slack_sent: false,
    });
    expect(getCapturedWhere()).toEqual(
      and(
        eq(schema.users.emailVerified, true),
        not(ilike(schema.users.email, CALUNO_ORG_EMAIL_LIKE)),
      ),
    );
  });

  it('skips the Slack post when the webhook env is unset', async () => {
    const fetchImpl = mock(async () => new Response('ok'));
    globalThis.fetch = fetchImpl as never;

    const { service } = build({ count: 3, webhookUrl: undefined });
    const summary = await service.runTick();

    expect(summary.slack_sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips the Slack post when the webhook env is blank', async () => {
    const fetchImpl = mock(async () => new Response('ok'));
    globalThis.fetch = fetchImpl as never;

    const { service } = build({ count: 3, webhookUrl: '   ' });
    const summary = await service.runTick();

    expect(summary.slack_sent).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the count to Slack when the webhook env is set', async () => {
    const fetchImpl = mock(async () => new Response('ok', { status: 200 }));
    globalThis.fetch = fetchImpl as never;

    const { service } = build({
      count: 12,
      webhookUrl: 'https://hooks.slack.com/services/T/B/X',
    });
    const summary = await service.runTick();

    expect(summary).toEqual({
      verified_user_count: 12,
      slack_sent: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toBe('https://hooks.slack.com/services/T/B/X');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'Verified user accounts: 12',
    });
  });

  it('throws when Slack responds non-OK so the locked tick logs failure', async () => {
    globalThis.fetch = mock(
      async () => new Response('nope', { status: 500 }),
    ) as never;

    const { service } = build({
      count: 1,
      webhookUrl: 'https://hooks.slack.com/services/T/B/X',
    });

    await expect(service.runTick()).rejects.toThrow(
      /Slack webhook responded 500/,
    );
  });
});
