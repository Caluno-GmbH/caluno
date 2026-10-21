import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import { TermsChangeClass } from '../enums';
import type { TermsService } from './terms.service';
import type { TermsNotificationService } from './terms-notification.service';
import { TermsPublishService } from './terms-publish.service';

function makeLock(locked: boolean) {
  const tryWithLock = mock(
    async <T>(_key: number, run: () => Promise<T>): Promise<T | null> =>
      locked ? run() : null,
  );
  return {
    lock: { tryWithLock } as unknown as AdvisoryLockService,
    tryWithLock,
  };
}

function makeService(
  lock: AdvisoryLockService,
  termsService: unknown,
  notifier: unknown,
): TermsPublishService {
  return new TermsPublishService(
    lock,
    termsService as TermsService,
    notifier as TermsNotificationService,
  );
}

describe('TermsPublishService single-publisher lock', () => {
  it('does nothing when another publisher holds the lock', async () => {
    const { lock } = makeLock(false);
    const termsService = {
      listPublishedVersions: mock(async () => []),
      publishVersion: mock(async () => ({})),
      markNotified: mock(async () => {}),
    };
    const notifier = { broadcastForVersion: mock(async () => 0) };

    const result = await makeService(
      lock,
      termsService,
      notifier,
    ).publishPendingVersions();

    expect(result).toEqual({ published: [], notified: [] });
    expect(termsService.listPublishedVersions).not.toHaveBeenCalled();
    expect(notifier.broadcastForVersion).not.toHaveBeenCalled();
  });

  it('broadcasts under the lock and releases it', async () => {
    const { lock, tryWithLock } = makeLock(true);
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
      lock,
      termsService,
      notifier,
    ).publishPendingVersions();

    expect(tryWithLock.mock.calls[0]?.[0]).toBe(
      ADVISORY_LOCK_KEYS.termsPublish,
    );
    expect(notifier.broadcastForVersion).toHaveBeenCalledTimes(1);
    expect(termsService.markNotified).toHaveBeenCalledWith('1.0');
    expect(result.notified.map((entry) => entry.version)).toEqual(['1.0']);
  });
});
