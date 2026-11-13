import { describe, expect, it } from 'bun:test';
import {
  alreadyCheckedInDecideHref,
  countMissingRequiredForms,
  resolveCheckInReadiness,
  resolvePendingMembershipView,
  resolveVisibleCheckInReadiness,
  shouldShowIdVerification,
} from '../check-in-readiness';

describe('resolveCheckInReadiness', () => {
  it('returns notMember when not a member and no open request', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: false,
        membershipRequest: null,
        isParticipating: false,
      }),
    ).toBe('notMember');
  });

  it('returns pendingMembership when not a member but a request is open', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: false,
        membershipRequest: { id: 'req-1' },
        isParticipating: false,
      }),
    ).toBe('pendingMembership');
  });

  it('returns notInShift for a member who is not participating', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: true,
        membershipRequest: null,
        isParticipating: false,
      }),
    ).toBe('notInShift');
  });

  it('returns notInShift for a member with only an INVITED (not accepted) invite', () => {
    // isParticipating is already false here — the backend's
    // isParticipatingShiftInviteStatus excludes INVITED before this facts
    // object is ever built. This fixture documents that boundary at this
    // layer too, per the spec's testing section.
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: true,
        membershipRequest: null,
        isParticipating: false,
      }),
    ).toBe('notInShift');
  });

  it('returns ready for a member who is participating', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: true,
        membershipRequest: null,
        isParticipating: true,
      }),
    ).toBe('ready');
  });

  it('prioritizes membership over participation when both are missing', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: false,
        isMember: false,
        membershipRequest: null,
        isParticipating: false,
      }),
    ).toBe('notMember');
  });

  it('returns alreadyCheckedIn when the volunteer has an open entry, even if otherwise ready', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: true,
        isMember: true,
        membershipRequest: null,
        isParticipating: true,
      }),
    ).toBe('alreadyCheckedIn');
  });

  it('prioritizes alreadyCheckedIn over membership blockers', () => {
    expect(
      resolveCheckInReadiness({
        hasOpenTimeEntry: true,
        isMember: false,
        membershipRequest: null,
        isParticipating: false,
      }),
    ).toBe('alreadyCheckedIn');
  });
});

describe('resolveCheckInReadiness without a shift', () => {
  const noShift = { requiresShift: false };

  it('returns ready for a member, ignoring participation', () => {
    expect(
      resolveCheckInReadiness(
        {
          hasOpenTimeEntry: false,
          isMember: true,
          membershipRequest: null,
          isParticipating: false,
        },
        noShift,
      ),
    ).toBe('ready');
  });

  it('ignores an open time entry: there is no instance to be checked into', () => {
    expect(
      resolveCheckInReadiness(
        {
          hasOpenTimeEntry: true,
          isMember: true,
          membershipRequest: null,
          isParticipating: false,
        },
        noShift,
      ),
    ).toBe('ready');
  });

  it('still blocks a non-member', () => {
    expect(
      resolveCheckInReadiness(
        {
          hasOpenTimeEntry: false,
          isMember: false,
          membershipRequest: null,
          isParticipating: false,
        },
        noShift,
      ),
    ).toBe('notMember');
  });

  it('still blocks on a pending membership request', () => {
    expect(
      resolveCheckInReadiness(
        {
          hasOpenTimeEntry: false,
          isMember: false,
          membershipRequest: { id: 'req-1' },
          isParticipating: false,
        },
        noShift,
      ),
    ).toBe('pendingMembership');
  });
});

describe('alreadyCheckedInDecideHref', () => {
  it('points at the decide page, which lists open entries with check-out links', () => {
    expect(alreadyCheckedInDecideHref('abc-123')).toBe(
      '/check-in/abc-123/decide',
    );
  });
});

describe('shouldShowIdVerification', () => {
  const base = {
    state: 'ready' as const,
    idVerificationEnabled: true,
    idVerified: false,
    membershipId: 'm-1',
  };

  it('shows for an unverified member when the feature is enabled and readiness is ready', () => {
    expect(shouldShowIdVerification(base)).toBe(true);
  });

  it('stays hidden once the membership is verified (no re-trigger on later check-ins)', () => {
    expect(shouldShowIdVerification({ ...base, idVerified: true })).toBe(false);
  });

  it('stays hidden when the feature is disabled for the org unit', () => {
    expect(
      shouldShowIdVerification({ ...base, idVerificationEnabled: false }),
    ).toBe(false);
  });

  it('stays hidden while any readiness blocker is active', () => {
    for (const state of [
      'alreadyCheckedIn',
      'notMember',
      'pendingMembership',
      'notInShift',
    ] as const) {
      expect(shouldShowIdVerification({ ...base, state })).toBe(false);
    }
  });

  it('stays hidden without a membership id (nothing to verify)', () => {
    expect(shouldShowIdVerification({ ...base, membershipId: null })).toBe(
      false,
    );
  });
});

describe('resolveVisibleCheckInReadiness', () => {
  const noChoice = { withoutShift: false, shiftInstanceId: null };

  it('shows the membership blockers before any shift is chosen', () => {
    expect(resolveVisibleCheckInReadiness('notMember', noChoice)).toBe(
      'notMember',
    );
    expect(resolveVisibleCheckInReadiness('pendingMembership', noChoice)).toBe(
      'pendingMembership',
    );
  });

  it('hides shift-scoped states until a shift or without-assignment is chosen', () => {
    expect(resolveVisibleCheckInReadiness('notInShift', noChoice)).toBeNull();
    expect(resolveVisibleCheckInReadiness('ready', noChoice)).toBeNull();
    expect(
      resolveVisibleCheckInReadiness('alreadyCheckedIn', noChoice),
    ).toBeNull();
  });

  it('passes every state through once an instance is chosen', () => {
    const chosen = { withoutShift: false, shiftInstanceId: 'inst-1' };
    expect(resolveVisibleCheckInReadiness('notInShift', chosen)).toBe(
      'notInShift',
    );
    expect(resolveVisibleCheckInReadiness('ready', chosen)).toBe('ready');
  });

  it('passes ready through when checking in without assignment', () => {
    expect(
      resolveVisibleCheckInReadiness('ready', {
        withoutShift: true,
        shiftInstanceId: null,
      }),
    ).toBe('ready');
  });

  it('keeps an unloaded readiness null', () => {
    expect(resolveVisibleCheckInReadiness(null, noChoice)).toBeNull();
  });
});

describe('countMissingRequiredForms', () => {
  it('returns null while the forms are not loaded yet', () => {
    expect(
      countMissingRequiredForms({ forms: undefined, isError: false }),
    ).toBeNull();
  });

  it('returns null when the forms query errored, even with stale data', () => {
    expect(
      countMissingRequiredForms({
        forms: [{ submitted: true }],
        isError: true,
      }),
    ).toBeNull();
  });

  it('returns 0 when every required form is submitted', () => {
    expect(
      countMissingRequiredForms({
        forms: [{ submitted: true }, { submitted: true }],
        isError: false,
      }),
    ).toBe(0);
  });

  it('returns 0 when the unit has no required forms', () => {
    expect(countMissingRequiredForms({ forms: [], isError: false })).toBe(0);
  });

  it('counts the forms still open', () => {
    expect(
      countMissingRequiredForms({
        forms: [
          { submitted: false },
          { submitted: true },
          { submitted: false },
        ],
        isError: false,
      }),
    ).toBe(2);
  });
});

describe('resolvePendingMembershipView', () => {
  it('requires a unit manager when the caller cannot accept, whatever the forms', () => {
    for (const missingFormCount of [null, 0, 2]) {
      expect(
        resolvePendingMembershipView({
          canAccept: false,
          missingFormCount,
        }),
      ).toBe('requiresUnitManager');
    }
  });

  it('checks the forms while they are unknown', () => {
    expect(
      resolvePendingMembershipView({
        canAccept: true,
        missingFormCount: null,
      }),
    ).toBe('checkingForms');
  });

  it('reports open forms', () => {
    expect(
      resolvePendingMembershipView({
        canAccept: true,
        missingFormCount: 1,
      }),
    ).toBe('formsOpen');
  });

  it('offers the accept once every form is submitted', () => {
    expect(
      resolvePendingMembershipView({
        canAccept: true,
        missingFormCount: 0,
      }),
    ).toBe('acceptable');
  });
});
