import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { findLog, recordSchedulerLogs } from './scheduler-log-recorder';
import type { UnderstaffedTickSummary } from './shift-understaffed-notification.service';
import { ShiftUnderstaffedSchedulerService } from './shift-understaffed-scheduler.service';

const SUMMARY: UnderstaffedTickSummary = {
  candidates: 42,
  below_minimum: 7,
  call_outs_fired: 3,
  reminders_fired: 1,
  rearmed: 35,
  skipped_no_minimum: 0,
  skipped_automation_off: 2,
  failed: 0,
};

function passThroughLock(): AdvisoryLockService {
  return {
    tryWithLock: <T>(_key: number, run: () => Promise<T>) => run(),
  } as unknown as AdvisoryLockService;
}

function scheduler(
  runTick: () => Promise<UnderstaffedTickSummary>,
  advisoryLock: AdvisoryLockService = passThroughLock(),
) {
  const service = new ShiftUnderstaffedSchedulerService(
    {
      runTick,
    } as never,
    advisoryLock,
  );
  return { service, records: recordSchedulerLogs(service) };
}

describe('ShiftUnderstaffedSchedulerService', () => {
  it('logs that the tick started so a missing run is visible', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleTick();

    expect(findLog(records, 'understaffed_tick.started')).toBeDefined();
  });

  it('logs the tick counts and duration on success', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleTick();

    const finished = findLog(records, 'understaffed_tick.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject({
      candidates: 42,
      below_minimum: 7,
      call_outs_fired: 3,
      reminders_fired: 1,
      rearmed: 35,
    });
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('logs a failure with the error and does not rethrow', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(() => Promise.reject(boom));

    await service.handleTick();

    const failed = findLog(records, 'understaffed_tick.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(findLog(records, 'understaffed_tick.finished')).toBeUndefined();
  });

  it('skips the tick when another instance holds the lock', async () => {
    const runTick = mock(async () => SUMMARY);
    const { service, records } = scheduler(runTick, {
      tryWithLock: async () => null,
    } as unknown as AdvisoryLockService);

    await service.handleTick();

    expect(runTick).not.toHaveBeenCalled();
    expect(findLog(records, 'understaffed_tick.skipped_locked')).toBeDefined();
    expect(findLog(records, 'understaffed_tick.finished')).toBeUndefined();
  });
});
