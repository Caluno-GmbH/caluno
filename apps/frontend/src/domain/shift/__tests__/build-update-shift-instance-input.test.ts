import { describe, expect, it } from 'bun:test';
import { ShiftVisibility } from '@repo/data';
import { buildUpdateShiftInstanceSeriesFields } from '../build-update-shift-instance-input';

describe('buildUpdateShiftInstanceSeriesFields', () => {
  it('includes visibility when editing a one-off instance (applyToAllFuture false)', () => {
    const fields = buildUpdateShiftInstanceSeriesFields({
      openShift: true,
      applyToAllFuture: false,
    });

    expect(fields).toEqual({
      visibility: ShiftVisibility.AllMembers,
    });
  });

  it('maps closed → InvitedMembers on a one-off edit', () => {
    const fields = buildUpdateShiftInstanceSeriesFields({
      openShift: false,
      applyToAllFuture: false,
    });

    expect(fields).toEqual({
      visibility: ShiftVisibility.InvitedMembers,
    });
  });

  it('includes visibility and rrule when applying to all future', () => {
    const fields = buildUpdateShiftInstanceSeriesFields({
      openShift: true,
      applyToAllFuture: true,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });

    expect(fields).toEqual({
      visibility: ShiftVisibility.AllMembers,
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
    });
  });
});
