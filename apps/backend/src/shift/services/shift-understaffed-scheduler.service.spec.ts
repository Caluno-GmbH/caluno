import { describe, expect, it } from 'bun:test';
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
  failed: 0,
};

function scheduler(runTick: () => Promise<UnderstaffedTickSummary>) {
  const service = new ShiftUnderstaffedSchedulerService({
    runTick,
  } as never);
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
});
