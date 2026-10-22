import { describe, expect, it } from 'bun:test';
import { BadRequestGraphQLError } from '../../graphql/errors';
import {
  assertEndAfterStart,
  assertStartNotAfterShiftEnd,
} from './time-entry-times';

const START = new Date('2026-10-22T10:00:00+02:00');

describe('assertEndAfterStart', () => {
  it('rejects end equal to start', () => {
    expect(() => assertEndAfterStart(START, new Date(START))).toThrow(
      BadRequestGraphQLError,
    );
    expect(() => assertEndAfterStart(START, new Date(START))).toThrow(
      'Time entry must end after it starts',
    );
  });

  it('rejects end before start', () => {
    expect(() =>
      assertEndAfterStart(START, new Date('2026-10-22T09:00:00+02:00')),
    ).toThrow('Time entry must end after it starts');
  });

  it('accepts null end', () => {
    expect(() => assertEndAfterStart(START, null)).not.toThrow();
    expect(() => assertEndAfterStart(START, undefined)).not.toThrow();
  });

  it('accepts overnight', () => {
    expect(() =>
      assertEndAfterStart(
        new Date('2026-10-22T22:00:00+02:00'),
        new Date('2026-10-23T02:00:00+02:00'),
      ),
    ).not.toThrow();
  });
});

describe('assertStartNotAfterShiftEnd', () => {
  const shiftEnd = new Date('2026-10-22T18:00:00+02:00');

  it('rejects start one minute after shift end', () => {
    expect(() =>
      assertStartNotAfterShiftEnd(
        new Date('2026-10-22T18:01:00+02:00'),
        shiftEnd,
      ),
    ).toThrow('Check-in cannot be later than the shift end');
  });

  it('accepts start equal to shift end', () => {
    expect(() =>
      assertStartNotAfterShiftEnd(new Date(shiftEnd), shiftEnd),
    ).not.toThrow();
  });
});
