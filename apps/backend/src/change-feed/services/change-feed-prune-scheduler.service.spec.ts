import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  findLog,
  recordSchedulerLogs,
} from '../../shift/services/scheduler-log-recorder';
import { ChangeFeedPruneSchedulerService } from './change-feed-prune-scheduler.service';

const SUMMARY = { deleted: 3 };

function scheduler(
  pruneExpired: () => Promise<{ deleted: number }>,
  tryWithLock: AdvisoryLockService['tryWithLock'],
) {
  const service = new ChangeFeedPruneSchedulerService(
    { pruneExpired } as never,
    { tryWithLock } as unknown as AdvisoryLockService,
  );
  return { service, records: recordSchedulerLogs(service) };
}

describe('ChangeFeedPruneSchedulerService', () => {
  it('runs the prune under the lock', async () => {
    const pruneExpired = mock(async () => SUMMARY);
    const lockKeys: number[] = [];
    const { service, records } = scheduler(pruneExpired, async (key, run) => {
      lockKeys.push(key);
      return run();
    });

    await service.handleTick();

    expect(lockKeys).toEqual([ADVISORY_LOCK_KEYS.changeFeedPruneTick]);
    expect(pruneExpired).toHaveBeenCalledTimes(1);
    expect(findLog(records, 'change_feed_prune_tick.started')).toBeDefined();
    const finished = findLog(records, 'change_feed_prune_tick.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject({ deleted: 3 });
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('skips when locked', async () => {
    const pruneExpired = mock(async () => SUMMARY);
    const { service, records } = scheduler(pruneExpired, async () => null);

    await service.handleTick();

    expect(pruneExpired).not.toHaveBeenCalled();
    expect(
      findLog(records, 'change_feed_prune_tick.skipped_locked'),
    ).toBeDefined();
    expect(findLog(records, 'change_feed_prune_tick.finished')).toBeUndefined();
  });

  it('logs and swallows prune errors', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(
      () => Promise.reject(boom),
      (_key, run) => run(),
    );

    await expect(service.handleTick()).resolves.toBeUndefined();

    const failed = findLog(records, 'change_feed_prune_tick.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(findLog(records, 'change_feed_prune_tick.finished')).toBeUndefined();
  });
});
