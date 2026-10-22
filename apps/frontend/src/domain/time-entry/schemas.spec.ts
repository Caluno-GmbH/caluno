import { describe, expect, it } from 'bun:test';
import { clientTimeEntrySchema, serverCheckInVolunteerSchema } from './schemas';

const messages = {
  organizationUnitRequired: 'Organization Unit is required',
  shiftInstanceRequired: 'Shift date is required',
  volunteerRequired: 'Volunteer is required',
  startedAtRequired: 'Start time is required',
  endedAtRequired: 'End time is required',
  timeEntryIdRequired: 'Time Entry ID is required',
  reimbursementTypeRequired: 'Pauschale type is required',
  endBeforeStart: 'Check-out must be after check-in',
  startAfterShiftEnd: (shiftEnd: Date) =>
    `after shift end ${shiftEnd.toISOString()}`,
};

const baseValues = {
  organizationUnitId: 'org-unit-1',
  volunteerId: 'volunteer-1',
  startedAt: new Date('2026-01-01T09:00:00Z'),
  endedAt: new Date('2026-01-01T11:00:00Z'),
  hasShift: false,
  isPaidTime: false,
};

describe('clientTimeEntrySchema', () => {
  it('accepts an unpaid entry with no reimbursement type', () => {
    const result = clientTimeEntrySchema(messages).safeParse(baseValues);
    expect(result.success).toBe(true);
  });

  it('requires a reimbursement type when marked as paid time', () => {
    const result = clientTimeEntrySchema(messages).safeParse({
      ...baseValues,
      isPaidTime: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'reimbursementTypeId',
      );
      expect(issue?.message).toBe('Pauschale type is required');
    }
  });

  it('accepts a paid entry once a reimbursement type is set', () => {
    const result = clientTimeEntrySchema(messages).safeParse({
      ...baseValues,
      isPaidTime: true,
      reimbursementTypeId: 'reimbursement-type-1',
    });
    expect(result.success).toBe(true);
  });

  it('still requires a shift instance when hasShift is true, independent of paid status', () => {
    const result = clientTimeEntrySchema(messages).safeParse({
      ...baseValues,
      hasShift: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'shiftInstanceId',
      );
      expect(issue?.message).toBe('Shift date is required');
    }
  });
});

describe('clientTimeEntrySchema time checks', () => {
  const schema = () => clientTimeEntrySchema(messages);

  it('rejects endedAt <= startedAt on path endedAt', () => {
    for (const endedAt of [
      new Date('2026-01-01T09:00:00Z'),
      new Date('2026-01-01T08:00:00Z'),
    ]) {
      const result = schema().safeParse({ ...baseValues, endedAt });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === 'endedAt');
        expect(issue?.message).toBe('Check-out must be after check-in');
      }
    }
  });

  it('accepts a missing endedAt', () => {
    const result = schema().safeParse({ ...baseValues, endedAt: null });
    expect(result.success).toBe(true);
  });

  it('rejects startedAt after shiftInstanceEndsAt on path startedAt', () => {
    const shiftInstanceEndsAt = new Date('2026-01-01T08:00:00Z');
    const result = schema().safeParse({ ...baseValues, shiftInstanceEndsAt });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'startedAt');
      expect(issue?.message).toBe(
        `after shift end ${shiftInstanceEndsAt.toISOString()}`,
      );
    }
  });

  it('allows a start exactly at the shift end', () => {
    const result = schema().safeParse({
      ...baseValues,
      shiftInstanceEndsAt: baseValues.startedAt,
    });
    expect(result.success).toBe(true);
  });

  it('allows the end to be after the shift end', () => {
    const result = schema().safeParse({
      ...baseValues,
      shiftInstanceEndsAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(result.success).toBe(true);
  });

  it('overnight start within shift', () => {
    const result = schema().safeParse({
      ...baseValues,
      startedAt: new Date('2026-10-22T22:00:00'),
      endedAt: new Date('2026-10-23T02:00:00'),
      shiftInstanceEndsAt: new Date('2026-10-23T02:00:00'),
    });
    expect(result.success).toBe(true);
  });

  it('no shift instance skips the shift check', () => {
    for (const shiftInstanceEndsAt of [undefined, null]) {
      const result = schema().safeParse({
        ...baseValues,
        startedAt: new Date('2030-01-01T09:00:00Z'),
        endedAt: new Date('2030-01-01T11:00:00Z'),
        shiftInstanceEndsAt,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('serverCheckInVolunteerSchema', () => {
  const base = {
    organizationUnitId: 'org-unit-1',
    volunteerId: 'volunteer-1',
    shiftInstanceId: null,
  };

  it('accepts a valid start time', () => {
    const result = serverCheckInVolunteerSchema.safeParse({
      ...base,
      startedAt: new Date('2026-09-28T08:00:00.000Z'),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing start time', () => {
    const result = serverCheckInVolunteerSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid start time', () => {
    const result = serverCheckInVolunteerSchema.safeParse({
      ...base,
      startedAt: new Date('not-a-date'),
    });
    expect(result.success).toBe(false);
  });
});
