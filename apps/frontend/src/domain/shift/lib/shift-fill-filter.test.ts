import { describe, expect, it } from 'bun:test';
import type {
  ShiftInstanceRow,
  ShiftMasterRow,
} from '../components/shifts-table';
import { applyFillFilter } from './shift-fill-filter';

function makeInstance(
  id: string,
  filledCount: number,
  resolvedMin: number | null,
  resolvedMax: number | null,
): ShiftInstanceRow {
  return {
    kind: 'instance',
    id,
    masterId: 'master-1',
    actualStartsAt: '2026-01-01T08:00:00Z',
    actualEndsAt: '2026-01-01T10:00:00Z',
    isCancelled: false,
    resolvedLocation: null,
    resolvedMin,
    resolvedMax,
    filledCount,
    pendingCount: 0,
    locationInherited: true,
  };
}

function makeMaster(id: string, subRows: ShiftInstanceRow[]): ShiftMasterRow {
  return {
    kind: 'master',
    id,
    title: `Shift ${id}`,
    rrule: null,
    originalStartsAt: '2026-01-01T08:00:00Z',
    durationMinutes: 120,
    visibility: 'ALL_MEMBERS' as ShiftMasterRow['visibility'],
    location: null,
    minVolunteers: null,
    maxVolunteers: null,
    reimbursementTypeId: null,
    isOneOff: false,
    singleInstance: null,
    subRows,
  };
}

function makeOneOff(id: string, instance: ShiftInstanceRow): ShiftMasterRow {
  return {
    ...makeMaster(id, []),
    isOneOff: true,
    singleInstance: instance,
  };
}

// alert: count=0 → below min
const instAlert = makeInstance('inst-alert', 0, 5, 10);
// neutral: count >= min but < max
const instNeutral = makeInstance('inst-neutral', 3, 2, 10);
// full: count >= max
const instFull = makeInstance('inst-full', 10, 5, 10);

const masters = [
  makeMaster('m1', [instAlert, instNeutral]),
  makeMaster('m2', [instFull]),
  makeMaster('m3', [instAlert, instFull]),
];

describe('applyFillFilter', () => {
  it("fill='' returns input unchanged (same reference)", () => {
    const result = applyFillFilter(masters, '');
    expect(result).toBe(masters);
  });

  it("fill='below' keeps only alert instances and drops masters with none", () => {
    const result = applyFillFilter(masters, 'below');
    // m2 has only full → dropped; m1 and m3 have alert instances
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(['m1', 'm3']);
    expect(result.map((m) => m.subRows.map((i) => i.id))).toEqual([
      ['inst-alert'],
      ['inst-alert'],
    ]);
  });

  it("fill='full' keeps only full instances and drops masters with none", () => {
    const result = applyFillFilter(masters, 'full');
    // m1 has only alert + neutral → dropped; m2 and m3 survive
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(['m2', 'm3']);
    expect(result.map((m) => m.subRows.map((i) => i.id))).toEqual([
      ['inst-full'],
      ['inst-full'],
    ]);
  });

  it("fill='ok' keeps only neutral instances", () => {
    const result = applyFillFilter(masters, 'ok');
    // only m1 has a neutral instance
    expect(result).toHaveLength(1);
    expect(result.map((m) => m.id)).toEqual(['m1']);
    expect(result.map((m) => m.subRows.map((i) => i.id))).toEqual([
      ['inst-neutral'],
    ]);
  });

  it('returns new master objects with filtered subRows (does not mutate input)', () => {
    const result = applyFillFilter(masters, 'full');
    const m3filtered = result.find((m) => m.id === 'm3');
    expect(m3filtered).not.toBe(masters[2]);
    // original unaffected
    expect(masters[2]?.subRows).toHaveLength(2);
  });

  it('drops a master that has zero matching instances', () => {
    const alertOnly = makeMaster('alert-only', [instAlert]);
    const result = applyFillFilter([alertOnly], 'full');
    expect(result).toHaveLength(0);
  });

  it('keeps a one-off master when its single instance matches (unchanged)', () => {
    const oneOff = makeOneOff('one-off', instFull);
    const result = applyFillFilter([oneOff], 'full');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(oneOff);
    // its (empty) subRows are not fabricated
    expect(result[0]?.subRows).toHaveLength(0);
  });

  it('drops a one-off master when its single instance does not match', () => {
    const oneOff = makeOneOff('one-off', instAlert);
    const result = applyFillFilter([oneOff], 'full');
    expect(result).toHaveLength(0);
  });
});
