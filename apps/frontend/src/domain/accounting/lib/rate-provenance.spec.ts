import { describe, expect, it } from 'bun:test';
import type { RawEffectiveRate } from '@repo/data/react';
import { resolveRateDisplay } from './rate-provenance';

const PLATFORM_DEFAULT_CENTS = 500;

function display(effectiveRate?: Partial<RawEffectiveRate>) {
  return resolveRateDisplay({
    platformDefaultRateCents: PLATFORM_DEFAULT_CENTS,
    effectiveRate: effectiveRate as RawEffectiveRate | undefined,
  });
}

describe('resolveRateDisplay', () => {
  it('names the ancestor a sub-org inherits its rate from', () => {
    const result = display({
      hourlyRateCents: 1000,
      fallbackRateCents: 1000,
      isOwnRate: false,
      sourceUnitName: 'Hauptverein',
    });

    expect(result.rateCents).toBe(1000);
    expect(result.provenance).toEqual({
      kind: 'inherited',
      sourceName: 'Hauptverein',
    });
  });

  it("shows the unit's own rate above the rate it replaces", () => {
    const result = display({
      hourlyRateCents: 1200,
      fallbackRateCents: 1000,
      isOwnRate: true,
      sourceUnitName: null,
    });

    expect(result.rateCents).toBe(1200);
    expect(result.provenance).toEqual({ kind: 'own', fallbackRateCents: 1000 });
  });

  it('adds no line when an own rate equals the rate it replaces', () => {
    const result = display({
      hourlyRateCents: 1000,
      fallbackRateCents: 1000,
      isOwnRate: true,
      sourceUnitName: null,
    });

    expect(result.rateCents).toBe(1000);
    expect(result.provenance).toEqual({ kind: 'none' });
  });

  it('adds no line for an inherited rate with no unit to attribute it to', () => {
    const result = display({
      hourlyRateCents: PLATFORM_DEFAULT_CENTS,
      fallbackRateCents: PLATFORM_DEFAULT_CENTS,
      isOwnRate: false,
      sourceUnitName: null,
    });

    expect(result.provenance).toEqual({ kind: 'none' });
  });

  it('falls back to the platform default while rates are unavailable', () => {
    const result = display(undefined);

    expect(result.rateCents).toBe(PLATFORM_DEFAULT_CENTS);
    expect(result.provenance).toEqual({ kind: 'none' });
  });
});
