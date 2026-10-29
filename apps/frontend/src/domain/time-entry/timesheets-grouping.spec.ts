import { describe, expect, it } from 'bun:test';
import { groupByAssignment, groupByVolunteer } from './timesheets-grouping';

const baseEntry = () => ({
  id: 'e1',
  status: 'Closed' as const,
  startedAt: '2024-01-01T08:00:00Z',
  endedAt: '2024-01-01T10:00:00Z',
  notes: null,
  createdAt: '2024-01-01T07:00:00Z',
  createdBy: null,
  volunteer: { id: 'v1', name: 'Alice', email: 'alice@test.com' },
  shiftInstance: {
    id: 'si1',
    overrideLocation: null,
    overrideTitle: null,
    actualStartsAt: '2024-01-01T08:00:00Z',
    actualEndsAt: '2024-01-01T10:00:00Z',
    master: { id: 'm1', title: 'Shift A', location: null },
  },
  organizationUnit: {
    id: 'ou1',
    name: 'Unit',
    street: null,
    zipCode: null,
    city: null,
    organization: { id: 'o1', name: 'Org' },
  },
});

describe('groupByVolunteer', () => {
  it('groups entries by volunteer id', () => {
    const e1 = { ...baseEntry(), id: 'e1' };
    const e2 = {
      ...baseEntry(),
      id: 'e2',
      volunteer: { id: 'v2', name: 'Bob', email: 'bob@test.com' },
    };
    const result = groupByVolunteer([e1, e2] as any);
    expect(result).toHaveLength(2);
    expect(result[0]!.volunteer.id).toBe('v1');
    expect(result[0]!.subRows).toHaveLength(1);
  });

  it('sums duration for the group', () => {
    const result = groupByVolunteer([baseEntry()] as any);
    // 08:00–10:00 = 120 minutes
    expect(result[0]!.totalDurationMinutes).toBe(120);
  });

  it('groups multiple entries under the same volunteer', () => {
    const e1 = { ...baseEntry(), id: 'e1' };
    const e2 = { ...baseEntry(), id: 'e2' };
    const result = groupByVolunteer([e1, e2] as any);
    expect(result).toHaveLength(1);
    expect(result[0]!.subRows).toHaveLength(2);
    expect(result[0]!.entryCount).toBe(2);
  });

  it('returns kind === volunteer for group rows', () => {
    const result = groupByVolunteer([baseEntry()] as any);
    expect(result[0]!.kind).toBe('volunteer');
  });
});

describe('groupByAssignment', () => {
  it('groups entries by shift master id', () => {
    const e1 = { ...baseEntry(), id: 'e1' };
    const e2 = {
      ...baseEntry(),
      id: 'e2',
      shiftInstance: {
        ...baseEntry().shiftInstance,
        id: 'si2',
        master: { id: 'm2', title: 'Shift B', location: null },
      },
    };
    const result = groupByAssignment([e1, e2] as any);
    expect(result).toHaveLength(2);
  });

  it('groups shiftless entries under orgUnit-based id', () => {
    const shiftless = { ...baseEntry(), id: 'e1', shiftInstance: null };
    const result = groupByAssignment([shiftless] as any);
    expect(result[0]!.id).toBe('shiftless-ou1');
    expect(result[0]!.title).toBe('Unit');
  });

  it('returns kind === assignment for group rows', () => {
    const result = groupByAssignment([baseEntry()] as any);
    expect(result[0]!.kind).toBe('assignment');
  });

  it('shows overrideTitle when present', () => {
    const e = {
      ...baseEntry(),
      shiftInstance: { ...baseEntry().shiftInstance, overrideTitle: 'Override' },
    };
    const result = groupByAssignment([e] as any);
    expect(result[0]!.title).toBe('Override');
  });
});
