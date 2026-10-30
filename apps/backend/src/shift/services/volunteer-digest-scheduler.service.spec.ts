import { describe, expect, it, mock } from 'bun:test';
import type { AdvisoryLockService } from '../../database/advisory-lock.service';
import { ADVISORY_LOCK_KEYS } from '../../database/advisory-lock-keys';
import { findLog, recordSchedulerLogs } from './scheduler-log-recorder';
import type { VolunteerDigestSummary } from './volunteer-digest.service';
import { VolunteerDigestSchedulerService } from './volunteer-digest-scheduler.service';

const SUMMARY: VolunteerDigestSummary = {
  due_units: 3,
  already_sent_today: 1,
  recipients: 120,
  sent: 88,
  skipped_no_content: 29,
  skipped_no_notification_data: 0,
  failed: 1,
};

function scheduler(
  sendDigests: () => Promise<VolunteerDigestSummary>,
  tryWithLock: AdvisoryLockService['tryWithLock'],
) {
  const service = new VolunteerDigestSchedulerService(
    { sendDigests } as never,
    { tryWithLock } as unknown as AdvisoryLockService,
  );
  return { service, records: recordSchedulerLogs(service) };
}

describe('VolunteerDigestSchedulerService', () => {
  it('runs the digest send under the lock', async () => {
    const sendDigests = mock(async () => SUMMARY);
    const lockKeys: number[] = [];
    const { service, records } = scheduler(sendDigests, async (key, run) => {
      lockKeys.push(key);
      return run();
    });

    await service.handleDigestTick();

    expect(lockKeys).toEqual([ADVISORY_LOCK_KEYS.volunteerDigestTick]);
    expect(sendDigests).toHaveBeenCalledTimes(1);
    expect(findLog(records, 'volunteer_digest.started')).toBeDefined();
    const finished = findLog(records, 'volunteer_digest.finished');
    expect(finished?.level).toBe('log');
    expect(finished?.fields).toMatchObject({
      due_units: 3,
      recipients: 120,
      sent: 88,
      skipped_no_content: 29,
      failed: 1,
    });
    expect(typeof finished?.fields.duration_ms).toBe('number');
  });

  it('skips when locked', async () => {
    const sendDigests = mock(async () => SUMMARY);
    const { service, records } = scheduler(sendDigests, async () => null);

    await service.handleDigestTick();

    expect(sendDigests).not.toHaveBeenCalled();
    expect(findLog(records, 'volunteer_digest.skipped_locked')).toBeDefined();
    expect(findLog(records, 'volunteer_digest.finished')).toBeUndefined();
  });

  it('logs a failure with the error and does not rethrow', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(
      () => Promise.reject(boom),
      (_key, run) => run(),
    );

    await expect(service.handleDigestTick()).resolves.toBeUndefined();

    const failed = findLog(records, 'volunteer_digest.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(findLog(records, 'volunteer_digest.finished')).toBeUndefined();
  });
});
