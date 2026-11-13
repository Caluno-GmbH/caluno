import type { CheckInReadinessState } from './check-in-readiness';

export const CHECK_IN_POLL_INTERVAL_MS = 4_000;
export const CHECK_IN_POLL_WINDOW_MS = 15 * 60_000;

/**
 * The admin is waiting on the volunteer (to scan, to be approved) while the
 * check-in is not related to them yet or their membership is not settled.
 */
export function isCheckInAwaitingVolunteer(input: {
  isRelated: boolean;
  state: CheckInReadinessState | null;
}): boolean {
  return (
    !input.isRelated ||
    input.state === 'notMember' ||
    input.state === 'pendingMembership'
  );
}

/** Polling stops once nothing has changed for the whole window. */
export function isPollWindowExpired(
  lastChangeAt: number,
  now: number,
): boolean {
  return now - lastChangeAt >= CHECK_IN_POLL_WINDOW_MS;
}
