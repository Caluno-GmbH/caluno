import { describe, expect, it } from 'bun:test';
import {
  isCheckInAwaitingVolunteer,
  isPollWindowExpired,
} from '../check-in-polling';

describe('isCheckInAwaitingVolunteer', () => {
  it('is true when the check-in is not related to the admin yet', () => {
    expect(isCheckInAwaitingVolunteer({ isRelated: false, state: null })).toBe(
      true,
    );
  });

  it('is true while the volunteer is not a member or has a pending request', () => {
    expect(
      isCheckInAwaitingVolunteer({ isRelated: true, state: 'notMember' }),
    ).toBe(true);
    expect(
      isCheckInAwaitingVolunteer({
        isRelated: true,
        state: 'pendingMembership',
      }),
    ).toBe(true);
  });

  it('is false once membership is settled', () => {
    expect(
      isCheckInAwaitingVolunteer({ isRelated: true, state: 'ready' }),
    ).toBe(false);
    expect(
      isCheckInAwaitingVolunteer({ isRelated: true, state: 'notInShift' }),
    ).toBe(false);
    expect(
      isCheckInAwaitingVolunteer({
        isRelated: true,
        state: 'alreadyCheckedIn',
      }),
    ).toBe(false);
  });
});

describe('isPollWindowExpired', () => {
  it('expires exactly at the window length', () => {
    expect(isPollWindowExpired(0, 15 * 60_000)).toBe(true);
  });

  it('has not expired one millisecond before the window length', () => {
    expect(isPollWindowExpired(0, 15 * 60_000 - 1)).toBe(false);
  });

  it('measures from the last change', () => {
    expect(isPollWindowExpired(60_000, 15 * 60_000)).toBe(false);
  });
});
