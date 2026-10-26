import { describe, expect, it, mock } from 'bun:test';
import { createEmailTemplateFixture } from '../../../test/helpers/email-template-fixture';
import type { Locale } from '../../graphql/locale';
import type { AutoClosedTimeEntry } from '../types/auto-closed-time-entry';
import { TimeEntryAutoClosedNotifier } from './time-entry-auto-closed-notifier.service';

// Bun's module mocks are process-global, and another spec in this suite stubs
// createEmailTemplateContext with a key-echoing translator that would leak
// into this file depending on run order. Pin it to the real catalogs so the
// locale assertions below hold regardless of order.
mock.module('../../notification/email/email-template-context', () => ({
  createEmailTemplateContext: (_appI18n: unknown, locale: Locale) =>
    createEmailTemplateFixture(locale),
}));

const STARTED_AT = new Date('2026-09-10T08:15:00.000Z');
const ENDED_AT = new Date('2026-09-10T12:30:00.000Z');

function entry(
  overrides: Partial<AutoClosedTimeEntry> = {},
): AutoClosedTimeEntry {
  return {
    id: 'entry-1',
    volunteerId: 'user-1',
    organizationUnitId: 'unit-1',
    shiftInstanceId: 'instance-1',
    startedAt: STARTED_AT,
    endedAt: ENDED_AT,
    ...overrides,
  };
}

interface DetailRow {
  entryId: string;
  organizationUnitName: string;
  overrideTitle: string | null;
  masterTitle: string | null;
}

function detail(overrides: Partial<DetailRow> = {}): DetailRow {
  return {
    entryId: 'entry-1',
    organizationUnitName: 'Acme Volunteers',
    overrideTitle: null,
    masterTitle: 'Food Distribution',
    ...overrides,
  };
}

function recipient(userId: string, locale: Locale = 'en') {
  return {
    userId,
    name: `Person ${userId}`,
    email: `${userId}@example.test`,
    firstName: `First-${userId}`,
    locale,
    checkInId: `check-in-${userId}`,
  };
}

function build(
  options: {
    details?: DetailRow[];
    recipients?: ReturnType<typeof recipient>[];
    send?: (input: { userId: string }) => Promise<void>;
    dbError?: Error;
  } = {},
) {
  const select = mock(() => {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'innerJoin', 'leftJoin']) {
      chain[method] = () => chain;
    }
    chain.where = async () => {
      if (options.dbError) throw options.dbError;
      return options.details ?? [detail()];
    };
    return chain;
  });
  const send = mock(options.send ?? (async () => undefined));
  const resolveUsersNotificationData = mock(
    async (userIds: string[]) =>
      options.recipients ?? userIds.map((userId) => recipient(userId)),
  );
  const notifier = new TimeEntryAutoClosedNotifier(
    { select } as never,
    { resolveUsersNotificationData } as never,
    { send } as never,
    {} as never,
  );

  return { notifier, select, send, resolveUsersNotificationData };
}

describe('TimeEntryAutoClosedNotifier', () => {
  it('sends one email per entry to the volunteer in their locale', async () => {
    const { notifier, send, resolveUsersNotificationData } = build({
      details: [
        detail({ entryId: 'entry-1' }),
        detail({ entryId: 'entry-2' }),
        detail({ entryId: 'entry-3' }),
      ],
      recipients: [recipient('user-1', 'de'), recipient('user-2', 'en')],
    });

    const result = await notifier.notify([
      entry({ id: 'entry-1', volunteerId: 'user-1' }),
      entry({ id: 'entry-2', volunteerId: 'user-1' }),
      entry({ id: 'entry-3', volunteerId: 'user-2' }),
    ]);

    expect(result).toEqual({ sent: 3, failed: 0 });
    expect(send).toHaveBeenCalledTimes(3);
    expect(resolveUsersNotificationData).toHaveBeenCalledTimes(1);
    expect(resolveUsersNotificationData.mock.calls[0]).toEqual([
      ['user-1', 'user-2'],
      { event: 'notification.time-entry.auto-closed' },
    ]);

    const sent = send.mock.calls.map(
      ([input]) => input as { userId: string; to: string; subject: string },
    );
    // Sends run concurrently, so match by recipient rather than call order.
    const toUser1 = sent.filter((mail) => mail.userId === 'user-1');
    const toUser2 = sent.filter((mail) => mail.userId === 'user-2');
    expect(toUser1).toHaveLength(2);
    expect(toUser2).toHaveLength(1);
    expect(toUser1[0].to).toBe('user-1@example.test');
    expect(toUser1.map((mail) => mail.subject)).toEqual([
      'Du wurdest automatisch ausgecheckt',
      'Du wurdest automatisch ausgecheckt',
    ]);
    expect(toUser2[0].subject).toBe('You were checked out automatically');
  });

  it('counts a failed send without throwing', async () => {
    const { notifier, send } = build({
      details: [detail({ entryId: 'entry-1' }), detail({ entryId: 'entry-2' })],
      send: async ({ userId }) => {
        if (userId === 'user-1') throw new Error('smtp down');
      },
    });

    const result = await notifier.notify([
      entry({ id: 'entry-1', volunteerId: 'user-1' }),
      entry({ id: 'entry-2', volunteerId: 'user-2' }),
    ]);

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('counts a volunteer without notification data as failed', async () => {
    const { notifier, send } = build({
      details: [detail({ entryId: 'entry-1' }), detail({ entryId: 'entry-2' })],
      recipients: [recipient('user-2')],
    });

    const result = await notifier.notify([
      entry({ id: 'entry-1', volunteerId: 'user-1' }),
      entry({ id: 'entry-2', volunteerId: 'user-2' }),
    ]);

    expect(result).toEqual({ sent: 1, failed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('counts every entry as failed when the lookup throws', async () => {
    const { notifier, send } = build({ dbError: new Error('db down') });

    const result = await notifier.notify([entry()]);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it('does nothing for an empty batch', async () => {
    const { notifier, select, resolveUsersNotificationData } = build();

    expect(await notifier.notify([])).toEqual({ sent: 0, failed: 0 });
    expect(select).not.toHaveBeenCalled();
    expect(resolveUsersNotificationData).not.toHaveBeenCalled();
  });

  it('resolves shift title (overrideTitle ?? master.title) and org unit name in one batch query', async () => {
    const { notifier, select, send } = build({
      details: [
        detail({
          entryId: 'entry-1',
          overrideTitle: 'Special Saturday',
          masterTitle: 'Food Distribution',
        }),
        detail({ entryId: 'entry-2' }),
        detail({
          entryId: 'entry-3',
          organizationUnitName: 'Other Unit',
          overrideTitle: null,
          masterTitle: null,
        }),
      ],
    });

    await notifier.notify([
      entry({ id: 'entry-1' }),
      entry({ id: 'entry-2' }),
      entry({ id: 'entry-3', shiftInstanceId: null }),
    ]);

    expect(select).toHaveBeenCalledTimes(1);
    const html = send.mock.calls.map(
      ([input]) => (input as { html: string }).html,
    );
    expect(html).toHaveLength(3);
    // Sends run concurrently, so find each mail by its distinguishing text.
    const withOverride = html.filter((body) =>
      body.includes('Special Saturday'),
    );
    const withMaster = html.filter((body) =>
      body.includes('Food Distribution'),
    );
    const shiftless = html.filter((body) => body.includes('Other Unit'));
    expect(withOverride).toHaveLength(1);
    expect(withOverride[0]).toContain('Acme Volunteers');
    expect(withOverride[0]).not.toContain('Food Distribution');
    expect(withMaster).toHaveLength(1);
    expect(withMaster[0]).not.toContain('Special Saturday');
    expect(shiftless).toHaveLength(1);
    expect(shiftless[0]).not.toContain('Food Distribution');
  });
});
