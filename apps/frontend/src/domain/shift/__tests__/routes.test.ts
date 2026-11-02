import { describe, expect, it } from 'bun:test';
import {
  checkInPath,
  checkOutPath,
  extractCheckInPath,
  parseShiftListQuery,
  shiftDetailPath,
  shiftInvitePath,
} from '../routes';

describe('checkInPath', () => {
  it('builds the check-in path without a query when no orgUId is given', () => {
    expect(checkInPath('abc123def456')).toBe('/check-in/abc123def456/check-in');
  });

  it('forwards the orgUId preference', () => {
    expect(checkInPath('abc123def456', 'org-1')).toBe(
      '/check-in/abc123def456/check-in?orgUId=org-1',
    );
  });

  it('encodes the orgUId', () => {
    expect(checkInPath('abc123def456', 'a b&c')).toBe(
      '/check-in/abc123def456/check-in?orgUId=a%20b%26c',
    );
  });

  it('adds no query for an empty orgUId', () => {
    expect(checkInPath('abc123def456', '')).toBe(
      '/check-in/abc123def456/check-in',
    );
  });
});

describe('checkOutPath', () => {
  it('builds the check-out path with the entryId', () => {
    expect(checkOutPath('abc123def456', 'e1')).toBe(
      '/check-in/abc123def456/check-out?entryId=e1',
    );
  });

  it('forwards the orgUId preference after the entryId', () => {
    expect(checkOutPath('abc123def456', 'e1', 'org-1')).toBe(
      '/check-in/abc123def456/check-out?entryId=e1&orgUId=org-1',
    );
  });

  it('encodes entryId and orgUId', () => {
    expect(checkOutPath('abc123def456', 'e 1', 'a&b')).toBe(
      '/check-in/abc123def456/check-out?entryId=e%201&orgUId=a%26b',
    );
  });
});

describe('extractCheckInPath', () => {
  it('extracts the check-in path from a full scanned URL', () => {
    expect(
      extractCheckInPath('https://app.caluno.com/admin/check-in/abc123def456'),
    ).toBe('/check-in/abc123def456/decide');
  });

  it('lowercases an uppercase check-in id', () => {
    expect(
      extractCheckInPath('https://app.caluno.com/admin/check-in/ABC123DEF456'),
    ).toBe('/check-in/abc123def456/decide');
  });

  it('returns null for a value that is not a check-in URL', () => {
    expect(extractCheckInPath('https://app.caluno.com/discover')).toBeNull();
  });

  it('returns null for a check-in id of the wrong length', () => {
    expect(
      extractCheckInPath('https://app.caluno.com/admin/check-in/short'),
    ).toBeNull();
  });
});

describe('shift list return query', () => {
  it('preserves all table filters in detail links', () => {
    const filters = {
      view: 'shifts' as const,
      location: 'Main Hall',
      visibility: 'INVITED_MEMBERS',
      dateFrom: '2026-10-29T00:00:00.000Z',
      dateTo: '2026-11-05T00:00:00.000Z',
      fill: 'below',
    };

    expect(shiftDetailPath('org-1', 'shift-1', filters)).toBe(
      '/admin/org-1/shifts/shift-1?view=shifts&location=Main+Hall&visibility=INVITED_MEMBERS&dateFrom=2026-10-29T00%3A00%3A00.000Z&dateTo=2026-11-05T00%3A00%3A00.000Z&fill=below',
    );
  });

  it('parses all table filters from detail search params', () => {
    expect(
      parseShiftListQuery({
        view: 'shifts',
        location: 'Main Hall',
        visibility: 'INVITED_MEMBERS',
        dateFrom: '2026-10-29T00:00:00.000Z',
        dateTo: '2026-11-05T00:00:00.000Z',
        fill: 'below',
      }),
    ).toEqual({
      view: 'shifts',
      week: undefined,
      page: undefined,
      pageSize: undefined,
      sort: undefined,
      dir: undefined,
      q: undefined,
      location: 'Main Hall',
      visibility: 'INVITED_MEMBERS',
      dateFrom: '2026-10-29T00:00:00.000Z',
      dateTo: '2026-11-05T00:00:00.000Z',
      fill: 'below',
    });
  });
});

describe('shiftInvitePath', () => {
  it('builds the invite URL with just instanceId when no options are given', () => {
    expect(shiftInvitePath('org-1', 'shift-1', 'instance-1')).toBe(
      '/admin/org-1/shifts/shift-1/invite?instanceId=instance-1',
    );
  });

  it('appends flow=create when requested', () => {
    expect(
      shiftInvitePath('org-1', 'shift-1', 'instance-1', { flow: 'create' }),
    ).toBe(
      '/admin/org-1/shifts/shift-1/invite?instanceId=instance-1&flow=create',
    );
  });
});
