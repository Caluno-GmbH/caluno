import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { findLog, recordSchedulerLogs } from './scheduler-log-recorder';
import { ShiftPauseApprovalSchedulerService } from './shift-pause-approval-scheduler.service';
import type { PauseApprovalSweepSummary } from './shift-pause-approval-sweep.service';

const SUMMARY: PauseApprovalSweepSummary = {
  candidates: 5,
  swept: 2,
  skipped_automation_off: 3,
  failed: 0,
};

function passThroughLock(): AdvisoryLockService {
  return {
    tryWithLock: <T>(_key: number, run: () => Promise<T>) => run(),
  } as unknown as AdvisoryLockService;
}

function scheduler(
  runTick: () => Promise<PauseApprovalSweepSummary>,
  advisoryLock: AdvisoryLockService = passThroughLock(),
) {
  const service = new ShiftPauseApprovalSchedulerService(
    {
      runTick,
    } as never,
    advisoryLock,
  );
  return { service, records: recordSchedulerLogs(service) };
}

describe('ShiftPauseApprovalSchedulerService', () => {
  it('logs that the tick started so a missing run is visible', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleTick();

    expect(findLog(records, 'pause_approval_tick.started')).toBeDefined();
  });

  it('logs the tick counts and duration on success', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleTick();

    const finished = findLog(records, 'pause_approval_tick.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject({
      candidates: 5,
      swept: 2,
      skipped_automation_off: 3,
      failed: 0,
    });
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('logs a failure with the error and does not rethrow', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(() => Promise.reject(boom));

    await service.handleTick();

    const failed = findLog(records, 'pause_approval_tick.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(findLog(records, 'pause_approval_tick.finished')).toBeUndefined();
  });

  it('skips the tick when another instance holds the lock', async () => {
    const runTick = mock(async () => SUMMARY);
    const { service, records } = scheduler(runTick, {
      tryWithLock: async () => null,
    } as unknown as AdvisoryLockService);

    await service.handleTick();

    expect(runTick).not.toHaveBeenCalled();
    expect(
      findLog(records, 'pause_approval_tick.skipped_locked'),
    ).toBeDefined();
    expect(findLog(records, 'pause_approval_tick.finished')).toBeUndefined();
  });
});
