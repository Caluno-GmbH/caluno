import { describe, expect, it } from 'bun:test';
import { TimeEntryClosureKind } from '../enums/time-entry-closure-kind.enum';
import { TimeEntryStatus } from '../enums/time-entry-status.enum';
import { deriveTimeEntryStatus } from './time-entry-status';

describe('deriveTimeEntryStatus', () => {
  it('is OPEN without endedAt', () =>
    expect(deriveTimeEntryStatus({ endedAt: null, closureKind: null })).toBe(
      TimeEntryStatus.OPEN,
    ));

  it('is AUTO_CLOSED for AUTO', () =>
    expect(
      deriveTimeEntryStatus({
        endedAt: new Date(),
        closureKind: TimeEntryClosureKind.AUTO,
      }),
    ).toBe(TimeEntryStatus.AUTO_CLOSED));

  it('is CLOSED for MANUAL', () =>
    expect(
      deriveTimeEntryStatus({
        endedAt: new Date(),
        closureKind: TimeEntryClosureKind.MANUAL,
      }),
    ).toBe(TimeEntryStatus.CLOSED));

  it('treats a closed entry with null closureKind as CLOSED', () =>
    expect(
      deriveTimeEntryStatus({ endedAt: new Date(), closureKind: null }),
    ).toBe(TimeEntryStatus.CLOSED));
});
