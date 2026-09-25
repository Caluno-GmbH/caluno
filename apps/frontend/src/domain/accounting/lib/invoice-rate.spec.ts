import { describe, expect, it } from 'bun:test';
import { formatRateInput, parseRateCents } from './invoice-rate';

describe('parseRateCents', () => {
  it('Reads a German decimal comma, which is what the field invites', () => {
    expect(parseRateCents('12,50')).toBe(1250);
  });

  it('Reads a decimal point too, for anyone who types one', () => {
    expect(parseRateCents('12.50')).toBe(1250);
  });

  it('Reads a whole number of euros', () => {
    expect(parseRateCents('15')).toBe(1500);
  });

  it('Ignores surrounding whitespace', () => {
    expect(parseRateCents('  9,00 ')).toBe(900);
  });

  it('Rounds to whole cents rather than carrying fractions of one', () => {
    expect(parseRateCents('12,555')).toBe(1256);
  });

  it('Holds off while the field is empty or half-typed', () => {
    expect(parseRateCents(null)).toBeUndefined();
    expect(parseRateCents('')).toBeUndefined();
    expect(parseRateCents('12,')).toBe(1200);
    expect(parseRateCents('abc')).toBeUndefined();
  });

  it('Refuses a rate of zero or less rather than charging nothing', () => {
    expect(parseRateCents('0')).toBeUndefined();
    expect(parseRateCents('-5')).toBeUndefined();
  });
});

describe('formatRateInput', () => {
  it('Shows cents as euros with a comma', () => {
    expect(formatRateInput(1250)).toBe('12,50');
    expect(formatRateInput(1500)).toBe('15,00');
  });

  it('Shows nothing when the organisation has no rate yet', () => {
    expect(formatRateInput(undefined)).toBe('');
  });
});
