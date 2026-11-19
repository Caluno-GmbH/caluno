import { describe, expect, it } from 'bun:test';
import { SHIFT_EXPORT_COLUMNS } from './shift-export-columns';

const CANONICAL_IDS = ['title', 'date', 'location', 'visibility', 'staffing'];

describe('SHIFT_EXPORT_COLUMNS', () => {
  it('exposes all shift columns with stable ids/order', () => {
    expect(SHIFT_EXPORT_COLUMNS.map((c) => c.id)).toEqual(CANONICAL_IDS);
  });

  it('marks title as required (optional: false, defaultOn: true)', () => {
    const col = SHIFT_EXPORT_COLUMNS.find((c) => c.id === 'title');
    expect(col?.optional).toBe(false);
    expect(col?.defaultOn).toBe(true);
  });

  it('marks all other columns as optional and defaultOn', () => {
    const others = SHIFT_EXPORT_COLUMNS.filter((c) => c.id !== 'title');
    for (const col of others) {
      expect(col.optional).toBe(true);
      expect(col.defaultOn).toBe(true);
    }
  });
});
