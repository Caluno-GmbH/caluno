import { describe, expect, it } from 'bun:test';
import { computeMustAccept } from './terms.service';

describe('computeMustAccept', () => {
  it('requires acceptance when there is no recorded acceptance', () => {
    expect(computeMustAccept(null, '1.0')).toBe(true);
    expect(computeMustAccept(undefined, '1.0')).toBe(true);
  });

  it('requires acceptance when behind the latest major', () => {
    expect(computeMustAccept('1.0', '2.0')).toBe(true);
  });

  it('does not require acceptance when on or ahead of the latest major', () => {
    expect(computeMustAccept('2.0', '2.0')).toBe(false);
    expect(computeMustAccept('2.1', '2.0')).toBe(false);
  });

  it('does not require acceptance when there is no major yet', () => {
    expect(computeMustAccept('1.0', null)).toBe(false);
    expect(computeMustAccept(null, null)).toBe(true);
  });
});
