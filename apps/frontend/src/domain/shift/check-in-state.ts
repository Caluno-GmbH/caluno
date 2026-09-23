import type { VolunteeringActionLabel } from '@repo/ui';

export type CheckInTimeEntry = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  volunteer: { id: string };
};

export type AcceptedRowCheckInState = 'accepted' | 'checked_in' | 'checked_out';

const MAX_CHECKED_OUT_TOOLTIP_LINES = 5;

export function groupTimeEntriesByVolunteer(
  entries: readonly CheckInTimeEntry[],
): Map<string, CheckInTimeEntry[]> {
  const byVolunteer = new Map<string, CheckInTimeEntry[]>();
  for (const entry of entries) {
    const list = byVolunteer.get(entry.volunteer.id) ?? [];
    list.push(entry);
    byVolunteer.set(entry.volunteer.id, list);
  }
  return byVolunteer;
}

/** Accepted-row display state, derived purely from time entries — ignores phase/timing. */
export function deriveAcceptedRowState(
  entries: readonly CheckInTimeEntry[] | undefined,
): AcceptedRowCheckInState {
  if (!entries || entries.length === 0) {
    return 'accepted';
  }
  const hasOpenEntry = entries.some((entry) => entry.endedAt == null);
  return hasOpenEntry ? 'checked_in' : 'checked_out';
}

/**
 * Which actions an accepted row's check-in state offers, gated on the
 * CHECK_IN_MANAGE permission. Deliberately NOT part of the shared status
 * config's default actions for 'accepted' (which stay ['Uninvite']):
 * every other surface that shows an accepted volunteer — before-shift
 * rosters, the event roster, volunteer-facing views — must keep that
 * generic default. This function is called from exactly one place,
 * the shift instance volunteers panel, so Check in/Check out can never
 * leak onto those other surfaces.
 */
export function acceptedRowActions(
  state: AcceptedRowCheckInState,
  canCheckIn: boolean,
): VolunteeringActionLabel[] {
  if (!canCheckIn) {
    return [];
  }
  return state === 'checked_in' ? ['Check out'] : ['Check in'];
}

/**
 * Whether an accepted row's check-in state permits the admin removal
 * dropdown target (ADMIN_REJECTED, displayed as "Removed"). A volunteer
 * who is checked in or checked out has a time entry -- open or recorded --
 * that removing them would orphan; their only status path from there is
 * Check out or re-Check in. Plain 'accepted' (no time entry yet) is
 * unaffected and keeps its normal removal option. `null` covers rows that
 * never had an accepted check-in state to begin with (invited, waitlisted,
 * etc.), which must also keep their normal removal option.
 */
export function canRemoveAcceptedRow(
  acceptedState: AcceptedRowCheckInState | null,
): boolean {
  return acceptedState !== 'checked_in' && acceptedState !== 'checked_out';
}

export function openTimeEntryId(
  entries: readonly CheckInTimeEntry[] | undefined,
): string | null {
  const open = entries?.find((entry) => entry.endedAt == null);
  return open?.id ?? null;
}

export function formatCheckedOutWindows(
  entries: readonly CheckInTimeEntry[],
  formatTime: (date: Date) => string,
): { lines: string[]; overflowCount: number } {
  const closed = entries
    .filter((entry) => entry.endedAt != null)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );

  const lines = closed
    .slice(0, MAX_CHECKED_OUT_TOOLTIP_LINES)
    .map(
      (entry) =>
        `${formatTime(new Date(entry.startedAt))} – ${formatTime(new Date(entry.endedAt as string))}`,
    );

  return {
    lines,
    overflowCount: Math.max(0, closed.length - MAX_CHECKED_OUT_TOOLTIP_LINES),
  };
}
