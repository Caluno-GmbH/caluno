/**
 * Maps the four readiness facts from `checkInReadiness` to one state, in
 * priority order: an open time entry for the selected instance wins over
 * everything (the check-in already happened), then membership blocks before
 * participation, and a pending request is distinguished from no request at
 * all. Without a shift, only the membership rung of that ladder applies.
 */

export type CheckInReadinessState =
  | 'alreadyCheckedIn'
  | 'notMember'
  | 'pendingMembership'
  | 'notInShift'
  | 'ready';

export type CheckInReadinessFacts = {
  hasOpenTimeEntry: boolean;
  isMember: boolean;
  membershipRequest: { id: string } | null;
  isParticipating: boolean;
};

/**
 * `requiresShift: false` is the check-in-without-shift mode: there is no
 * instance to be a participant of and none to already be checked into, so the
 * two shift-scoped states drop out and only the membership gate remains.
 */
export function resolveCheckInReadiness(
  facts: CheckInReadinessFacts,
  options?: { requiresShift?: boolean },
): CheckInReadinessState {
  const requiresShift = options?.requiresShift ?? true;

  if (requiresShift && facts.hasOpenTimeEntry) {
    return 'alreadyCheckedIn';
  }
  if (!facts.isMember) {
    return facts.membershipRequest ? 'pendingMembership' : 'notMember';
  }
  if (requiresShift && !facts.isParticipating) {
    return 'notInShift';
  }
  return 'ready';
}

/**
 * The already-checked-in blocker links to the decide page, which lists the
 * volunteer's open entries with per-entry check-out links, or redirects
 * straight to check-out when the volunteer has a single entry from today
 * (the check-out page itself requires an entryId this state doesn't have).
 */
export function alreadyCheckedInDecideHref(checkInId: string): string {
  return `/check-in/${checkInId}/decide`;
}

/**
 * Required forms are a hard gate on accepting a membership request, so the
 * gate fails closed: `null` (unknown — not loaded yet, or the query errored)
 * must block the accept just like a positive count.
 */
export function countMissingRequiredForms({
  forms,
  isError,
}: {
  forms: ReadonlyArray<{ submitted: boolean }> | undefined;
  isError: boolean;
}): number | null {
  if (!forms || isError) return null;
  return forms.filter((form) => !form.submitted).length;
}

export type PendingMembershipView =
  | 'requiresUnitManager'
  | 'checkingForms'
  | 'formsOpen'
  | 'acceptable';

/**
 * What the pending-membership card offers. A check-in desk may only grant
 * membership in units it manages, so a request to an ancestor the caller
 * does not manage gets no accept and no forms UX at all. Otherwise the
 * required forms gate the accept and fail closed while unknown.
 */
export function resolvePendingMembershipView({
  canAccept,
  missingFormCount,
}: {
  canAccept: boolean;
  missingFormCount: number | null;
}): PendingMembershipView {
  if (!canAccept) return 'requiresUnitManager';
  if (missingFormCount === null) return 'checkingForms';
  if (missingFormCount > 0) return 'formsOpen';
  return 'acceptable';
}

/**
 * The ID verification card is a read-only side output of the readiness
 * facts, not a readiness state: verification is optional and never blocks
 * check-in. It appears only once every real blocker is cleared (ready),
 * the org unit enabled the feature, and the membership is not yet verified.
 */
export function shouldShowIdVerification(facts: {
  state: CheckInReadinessState;
  idVerificationEnabled: boolean;
  idVerified: boolean;
  membershipId: string | null;
}): boolean {
  return (
    facts.state === 'ready' &&
    facts.idVerificationEnabled &&
    !facts.idVerified &&
    facts.membershipId !== null
  );
}

/**
 * Readiness loads as soon as the page opens (a null shift returns only the
 * membership facts), so the membership blockers show before any shift is
 * chosen: a freshly scanned volunteer can be invited right away. Everything
 * shift-scoped — not in shift, already checked in, ready and the check-in
 * button behind it — waits until an instance or "without assignment" is
 * chosen; before that the null-shift facts would read as "not in shift".
 */
export function resolveVisibleCheckInReadiness(
  state: CheckInReadinessState | null,
  selection: { withoutShift: boolean; shiftInstanceId: string | null },
): CheckInReadinessState | null {
  if (state === 'notMember' || state === 'pendingMembership') {
    return state;
  }
  if (!selection.withoutShift && !selection.shiftInstanceId) {
    return null;
  }
  return state;
}
