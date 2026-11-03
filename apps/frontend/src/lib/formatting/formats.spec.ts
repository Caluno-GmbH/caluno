import { describe, expect, it } from 'bun:test';
import { formats } from './formats';

describe('formatDurationByMinutesShort', () => {
  it('localizes the unit abbreviations per locale', () => {
    const en = formats('en').formatDurationByMinutesShort;
    expect(en(150)).toBe('2h 30m');
    expect(en(120)).toBe('2h');
    expect(en(45)).toBe('45m');
    expect(en(0)).toBe('0m');

    const de = formats('de').formatDurationByMinutesShort;
    expect(de(150)).toBe('2 Std. 30 Min.');
    expect(de(120)).toBe('2 Std.');
    expect(de(45)).toBe('45 Min.');
    expect(de(0)).toBe('0 Min.');
  });
});

describe('formatDurationShort', () => {
  it('localizes the worked-period duration per locale', () => {
    const start = '2026-10-01T09:00:00.000Z';
    const end = '2026-10-01T11:30:00.000Z'; // 2h 30m
    expect(formats('en').formatDurationShort(start, end)).toBe('2h 30m');
    expect(formats('de').formatDurationShort(start, end)).toBe(
      '2 Std. 30 Min.',
    );
  });
});
