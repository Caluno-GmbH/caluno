import { describe, expect, it, mock } from 'bun:test';
import { TermsChangeClass } from '../enums';
import type { TermsService } from './terms.service';
import type { TermsNotificationService } from './terms-notification.service';
import { TermsPublishService } from './terms-publish.service';

function makeDb(locked: boolean) {
  const query = mock(async (sql: string) => {
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ locked }] };
    }
    return { rows: [] };
  });
  const release = mock(() => {});
  const client = { query, release };
  const db = { $client: { connect: mock(async () => client) } };
  return { db, query, release };
}

function makeService(
  db: unknown,
  termsService: unknown,
  notifier: unknown,
): TermsPublishService {
  return new TermsPublishService(
    db as never,
    termsService as TermsService,
    notifier as TermsNotificationService,
  );
}

describe('TermsPublishService single-publisher lock', () => {
  it('does nothing when another publisher holds the lock', async () => {
    const { db, query } = makeDb(false);
    const termsService = {
      listPublishedVersions: mock(async () => []),
      publishVersion: mock(async () => ({})),
      markNotified: mock(async () => {}),
    };
    const notifier = { broadcastForVersion: mock(async () => 0) };

    const result = await makeService(
      db,
      termsService,
      notifier,
    ).publishPendingVersions();

    expect(result).toEqual({ published: [], notified: [] });
    expect(termsService.listPublishedVersions).not.toHaveBeenCalled();
    expect(notifier.broadcastForVersion).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('pg_try_advisory_lock'),
      ),
    ).toBe(true);
  });

  it('broadcasts under the lock and releases it', async () => {
    const { db, query, release } = makeDb(true);
    const termsService = {
      listPublishedVersions: mock(async () => [
        {
          version: '1.0',
          class: TermsChangeClass.MAJOR,
          publishedAt: new Date(),
          notificationSentAt: null,
        },
      ]),
      publishVersion: mock(async () => ({})),
      markNotified: mock(async () => {}),
    };
    const notifier = { broadcastForVersion: mock(async () => 1) };

    const result = await makeService(
      db,
      termsService,
      notifier,
    ).publishPendingVersions();

    expect(notifier.broadcastForVersion).toHaveBeenCalledTimes(1);
    expect(termsService.markNotified).toHaveBeenCalledWith('1.0');
    expect(result.notified.map((entry) => entry.version)).toEqual(['1.0']);
    expect(
      query.mock.calls.some((call) =>
        String(call[0]).includes('pg_advisory_unlock'),
      ),
    ).toBe(true);
    expect(release).toHaveBeenCalled();
  });
});
