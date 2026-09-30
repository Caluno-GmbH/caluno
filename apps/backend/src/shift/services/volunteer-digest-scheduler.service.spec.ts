import { describe, expect, it } from 'bun:test';
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

function scheduler(sendDigests: () => Promise<VolunteerDigestSummary>) {
  const service = new VolunteerDigestSchedulerService({
    sendDigests,
  } as never);
  return { service, records: recordSchedulerLogs(service) };
}

describe('VolunteerDigestSchedulerService', () => {
  it('logs that the run started so a missing run is visible', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleDigestTick();

    expect(findLog(records, 'volunteer_digest.started')).toBeDefined();
  });

  it('logs the send counts and duration on success', async () => {
    const { service, records } = scheduler(() => Promise.resolve(SUMMARY));

    await service.handleDigestTick();

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

  it('logs a failure with the error and does not rethrow', async () => {
    const boom = new Error('boom');
    const { service, records } = scheduler(() => Promise.reject(boom));

    await service.handleDigestTick();

    const failed = findLog(records, 'volunteer_digest.failed');
    expect(failed?.level).toBe('error');
    expect(failed?.fields.err).toBe(boom);
    expect(findLog(records, 'volunteer_digest.finished')).toBeUndefined();
  });
});
