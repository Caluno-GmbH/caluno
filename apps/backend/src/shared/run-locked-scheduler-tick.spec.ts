import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../database/advisory-lock.service';
import { runLockedSchedulerTick } from './run-locked-scheduler-tick';

const SUMMARY = { candidates: 2, failed: 0 };

interface RecordedLog {
  level: 'log' | 'error';
  fields: Record<string, unknown>;
  message: string;
}

function captureLogger() {
  const records: RecordedLog[] = [];
  const record =
    (level: RecordedLog['level']) =>
    (fields: Record<string, unknown>, message: string) => {
      records.push({ level, fields, message });
    };

  return {
    records,
    logger: { log: record('log'), error: record('error') },
  };
}

function findLog(records: RecordedLog[], event: string) {
  return records.find((entry) => entry.fields.event === event);
}

describe('runLockedSchedulerTick', () => {
  it('runs under the lock and logs started + finished with the summary', async () => {
    const run = mock(async () => SUMMARY);
    const lockKeys: number[] = [];
    const { logger, records } = captureLogger();

    await runLockedSchedulerTick({
      logger,
      advisoryLock: {
        tryWithLock: async (key, work) => {
          lockKeys.push(key);
          return work();
        },
      } as unknown as AdvisoryLockService,
      lockKey: 42,
      event: 'example_tick',
      run,
    });

    expect(lockKeys).toEqual([42]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(findLog(records, 'example_tick.started')).toBeDefined();
    const finished = findLog(records, 'example_tick.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject(SUMMARY);
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('skips when the lock is held', async () => {
    const run = mock(async () => SUMMARY);
    const { logger, records } = captureLogger();

    await runLockedSchedulerTick({
      logger,
      advisoryLock: {
        tryWithLock: async () => null,
      } as unknown as AdvisoryLockService,
      lockKey: 42,
      event: 'example_tick',
      run,
    });

    expect(run).not.toHaveBeenCalled();
    expect(findLog(records, 'example_tick.skipped_locked')).toBeDefined();
    expect(findLog(records, 'example_tick.finished')).toBeUndefined();
  });

  it('logs failures and does not rethrow', async () => {
    const boom = new Error('boom');
    const { logger, records } = captureLogger();

    await expect(
      runLockedSchedulerTick({
        logger,
        advisoryLock: {
          tryWithLock: (_key, work) => work(),
        } as unknown as AdvisoryLockService,
        lockKey: 42,
        event: 'example_tick',
        run: () => Promise.reject(boom),
      }),
    ).resolves.toBeUndefined();

    const failed = findLog(records, 'example_tick.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(typeof failed?.fields.duration_ms).toBe('number');
    expect(findLog(records, 'example_tick.finished')).toBeUndefined();
  });
});
