import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import {
  findLog,
  recordSchedulerLogs,
} from '../../shift/services/scheduler-log-recorder';
import { TimeEntryAutoCloseSchedulerService } from './time-entry-auto-close-scheduler.service';
import type { AutoCloseSweepSummary } from './time-entry-auto-close-sweep.service';

const SUMMARY: AutoCloseSweepSummary = {
  closed: 4,
  emailed: 2,
  email_skipped_stale: 1,
  failed: 1,
};

function scheduler(
  runTick: () => Promise<AutoCloseSweepSummary>,
  tryWithLock: AdvisoryLockService['tryWithLock'],
) {
  const service = new TimeEntryAutoCloseSchedulerService(
    { runTick } as never,
    { tryWithLock } as unknown as AdvisoryLockService,
  );
  return { service, records: recordSchedulerLogs(service) };
}

describe('TimeEntryAutoCloseSchedulerService', () => {
  it('runs the sweep under the lock', async () => {
    const runTick = mock(async () => SUMMARY);
    const lockKeys: number[] = [];
    const { service, records } = scheduler(runTick, async (key, run) => {
      lockKeys.push(key);
      return run();
    });

    await service.handleTick();

    expect(lockKeys).toEqual([ADVISORY_LOCK_KEYS.timeEntryAutoCloseTick]);
    expect(runTick).toHaveBeenCalledTimes(1);
    expect(
      findLog(records, 'time_entry_auto_close_tick.started'),
    ).toBeDefined();
    const finished = findLog(records, 'time_entry_auto_close_tick.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject({
      closed: 4,
      emailed: 2,
      email_skipped_stale: 1,
      failed: 1,
    });
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('skips when locked', async () => {
    const runTick = mock(async () => SUMMARY);
    const { service, records } = scheduler(runTick, async () => null);

    await service.handleTick();

    expect(runTick).not.toHaveBeenCalled();
    expect(
      findLog(records, 'time_entry_auto_close_tick.skipped_locked'),
    ).toBeDefined();
    expect(
      findLog(records, 'time_entry_auto_close_tick.finished'),
    ).toBeUndefined();
  });

  it('logs and swallows sweep errors', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(
      () => Promise.reject(boom),
      (_key, run) => run(),
    );

    await expect(service.handleTick()).resolves.toBeUndefined();

    const failed = findLog(records, 'time_entry_auto_close_tick.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(
      findLog(records, 'time_entry_auto_close_tick.finished'),
    ).toBeUndefined();
  });
});
