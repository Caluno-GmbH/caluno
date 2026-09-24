import { describe, expect, it } from 'bun:test';
import {
  acceptedRowActions,
  type CheckInTimeEntry,
  canRemoveAcceptedRow,
  deriveAcceptedRowState,
  formatCheckedOutWindows,
  groupTimeEntriesByVolunteer,
  openTimeEntryId,
} from '../check-in-state';

describe('groupTimeEntriesByVolunteer', () => {
  it('groups entries by volunteer id', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: null,
        volunteer: { id: 'user-1' },
      },
      {
        id: '2',
        startedAt: '2026-09-02T09:00:00.000Z',
        endedAt: null,
        volunteer: { id: 'user-2' },
      },
      {
        id: '3',
        startedAt: '2026-09-02T10:00:00.000Z',
        endedAt: '2026-09-02T11:00:00.000Z',
        volunteer: { id: 'user-1' },
      },
    ];

    const result = groupTimeEntriesByVolunteer(entries);

    expect(result.get('user-1')).toEqual([entries[0], entries[2]]);
    expect(result.get('user-2')).toEqual([entries[1]]);
    expect(result.get('user-3')).toBeUndefined();
  });
});

describe('deriveAcceptedRowState', () => {
  it('returns accepted when there are no entries', () => {
    expect(deriveAcceptedRowState(undefined)).toBe('accepted');
    expect(deriveAcceptedRowState([])).toBe('accepted');
  });

  it('returns checked_in when there is an open entry', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: '2026-09-02T09:00:00.000Z',
        volunteer: { id: 'user-1' },
      },
      {
        id: '2',
        startedAt: '2026-09-02T10:00:00.000Z',
        endedAt: null,
        volunteer: { id: 'user-1' },
      },
    ];

    expect(deriveAcceptedRowState(entries)).toBe('checked_in');
  });

  it('returns checked_out when every entry is closed', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: '2026-09-02T09:00:00.000Z',
        volunteer: { id: 'user-1' },
      },
    ];

    expect(deriveAcceptedRowState(entries)).toBe('checked_out');
  });
});

describe('openTimeEntryId', () => {
  it('returns the id of the open entry', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: '2026-09-02T09:00:00.000Z',
        volunteer: { id: 'user-1' },
      },
      {
        id: '2',
        startedAt: '2026-09-02T10:00:00.000Z',
        endedAt: null,
        volunteer: { id: 'user-1' },
      },
    ];

    expect(openTimeEntryId(entries)).toBe('2');
  });

  it('returns null when there is no open entry', () => {
    expect(openTimeEntryId(undefined)).toBeNull();
    expect(
      openTimeEntryId([
        {
          id: '1',
          startedAt: '2026-09-02T08:00:00.000Z',
          endedAt: '2026-09-02T09:00:00.000Z',
          volunteer: { id: 'user-1' },
        },
      ]),
    ).toBeNull();
  });
});

describe('formatCheckedOutWindows', () => {
  const formatTime = (date: Date) => date.toISOString().slice(11, 16); // 'HH:mm' for deterministic test output

  it('formats closed entries as HH:mm – HH:mm lines, sorted ascending', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '2',
        startedAt: '2026-09-02T13:00:00.000Z',
        endedAt: '2026-09-02T15:30:00.000Z',
        volunteer: { id: 'user-1' },
      },
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: '2026-09-02T12:00:00.000Z',
        volunteer: { id: 'user-1' },
      },
    ];

    const result = formatCheckedOutWindows(entries, formatTime);

    expect(result.lines).toEqual(['08:00 – 12:00', '13:00 – 15:30']);
    expect(result.overflowCount).toBe(0);
  });

  it('ignores open entries', () => {
    const entries: CheckInTimeEntry[] = [
      {
        id: '1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: null,
        volunteer: { id: 'user-1' },
      },
    ];

    const result = formatCheckedOutWindows(entries, formatTime);

    expect(result.lines).toEqual([]);
    expect(result.overflowCount).toBe(0);
  });

  it('caps lines at 5 and reports the overflow count', () => {
    const entries: CheckInTimeEntry[] = Array.from({ length: 7 }, (_, i) => ({
      id: `${i}`,
      startedAt: `2026-09-0${i + 1}T08:00:00.000Z`,
      endedAt: `2026-09-0${i + 1}T09:00:00.000Z`,
      volunteer: { id: 'user-1' },
    }));

    const result = formatCheckedOutWindows(entries, formatTime);

    expect(result.lines).toHaveLength(5);
    expect(result.overflowCount).toBe(2);
  });
});

describe('acceptedRowActions', () => {
  it('offers Check in for an accepted row that has not checked in', () => {
    expect(acceptedRowActions('accepted', true)).toEqual(['Check in']);
  });

  it('offers Check out for a checked-in row', () => {
    expect(acceptedRowActions('checked_in', true)).toEqual(['Check out']);
  });

  it('offers Check in again for a checked-out row', () => {
    expect(acceptedRowActions('checked_out', true)).toEqual(['Check in']);
  });

  it('offers nothing when the viewer lacks CHECK_IN_MANAGE, regardless of state', () => {
    expect(acceptedRowActions('accepted', false)).toEqual([]);
    expect(acceptedRowActions('checked_in', false)).toEqual([]);
    expect(acceptedRowActions('checked_out', false)).toEqual([]);
  });
});

describe('canRemoveAcceptedRow', () => {
  it('allows removal for a plain accepted row with no time entry', () => {
    expect(canRemoveAcceptedRow('accepted')).toBe(true);
  });

  it('forbids removal once the volunteer is checked in', () => {
    expect(canRemoveAcceptedRow('checked_in')).toBe(false);
  });

  it('forbids removal after the volunteer has checked out', () => {
    expect(canRemoveAcceptedRow('checked_out')).toBe(false);
  });

  it('allows removal when the row has no accepted check-in state at all', () => {
    // e.g. an invited/waitlisted row, which never computes an
    // AcceptedRowCheckInState in the panel.
    expect(canRemoveAcceptedRow(null)).toBe(true);
  });
});
