import { describe, expect, it } from 'bun:test';
import {
  effectiveUsedBefore,
  initialCapAmountEuros,
  parseEuroInputToCents,
  projectedCapAmount,
} from './manual-cap';

describe('initialCapAmountEuros', () => {
  it('treats a missing baseline as zero', () => {
    expect(initialCapAmountEuros(null)).toBe(0);
    expect(initialCapAmountEuros(undefined)).toBe(0);
  });

  it('converts the baseline cents to euros', () => {
    expect(initialCapAmountEuros(50000)).toBe(500);
    expect(initialCapAmountEuros(0)).toBe(0);
  });
});

describe('parseEuroInputToCents', () => {
  it('parses a whole-euro input', () => {
    expect(parseEuroInputToCents('500')).toBe(50000);
  });

  it('accepts comma and dot decimals', () => {
    expect(parseEuroInputToCents('4,5')).toBe(450);
    expect(parseEuroInputToCents('4.5')).toBe(450);
  });

  it('rejects empty and non-numeric input', () => {
    expect(parseEuroInputToCents('')).toBeNull();
    expect(parseEuroInputToCents('abc')).toBeNull();
  });

  it('rejects negative amounts', () => {
    expect(parseEuroInputToCents('-10')).toBeNull();
  });
});

describe('projectedCapAmount', () => {
  it('adds the used-before amount to the selected amount', () => {
    expect(projectedCapAmount(500, 250)).toBe(750);
  });
});

describe('effectiveUsedBefore', () => {
  it('leaves the stored figure alone while the initial amount is untouched', () => {
    expect(effectiveUsedBefore(100, null, null)).toBe(100);
    expect(effectiveUsedBefore(100, null, 50_000)).toBe(100);
  });

  it('folds a pending initial amount into the figure', () => {
    // 500,00 € pending, nothing saved before.
    expect(effectiveUsedBefore(100, 50_000, null)).toBe(600);
  });

  it('applies only the difference against an existing baseline', () => {
    // Saved 500,00 €, coordinator lowers it to 200,00 €.
    expect(effectiveUsedBefore(600, 20_000, 50_000)).toBe(300);
  });

  it('is a no-op when the pending value equals the saved one', () => {
    expect(effectiveUsedBefore(600, 50_000, 50_000)).toBe(600);
  });
});
