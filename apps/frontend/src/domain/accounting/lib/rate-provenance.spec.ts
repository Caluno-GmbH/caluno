import { describe, expect, it } from 'bun:test';
import { resolveRateDisplay } from './rate-provenance';

const PLATFORM_DEFAULT_CENTS = 500;
const SUB_UNIT = 'sub-unit';

function buildRate(
  overrides: Partial<Parameters<typeof resolveRateDisplay>[0]>,
) {
  return resolveRateDisplay({
    platformDefaultRateCents: PLATFORM_DEFAULT_CENTS,
    organizationUnitId: SUB_UNIT,
    ...overrides,
  });
}

describe('resolveRateDisplay', () => {
  it('shows a rate inherited from the parent with no fallback line', () => {
    const display = buildRate({
      effectiveRate: {
        hourlyRateCents: 1000,
        inheritedRateCents: 1000,
        isOverride: true,
        organizationUnitId: 'root-unit',
      } as never,
    });

    expect(display.rateCents).toBe(1000);
    expect(display.fallbackRateCents).toBeUndefined();
  });

  it("shows the unit's own rate above the parent rate it overrides", () => {
    const display = buildRate({
      effectiveRate: {
        hourlyRateCents: 1200,
        inheritedRateCents: 1000,
        isOverride: true,
        organizationUnitId: SUB_UNIT,
      } as never,
    });

    expect(display.rateCents).toBe(1200);
    expect(display.fallbackRateCents).toBe(1000);
  });

  it('shows the platform default with no fallback line when nothing is set', () => {
    const display = buildRate({
      effectiveRate: {
        hourlyRateCents: PLATFORM_DEFAULT_CENTS,
        inheritedRateCents: PLATFORM_DEFAULT_CENTS,
        isOverride: false,
        organizationUnitId: null,
      } as never,
    });

    expect(display.rateCents).toBe(PLATFORM_DEFAULT_CENTS);
    expect(display.fallbackRateCents).toBeUndefined();
  });

  it('falls back to the platform default while rates are unavailable', () => {
    const display = buildRate({ effectiveRate: undefined });

    expect(display.rateCents).toBe(PLATFORM_DEFAULT_CENTS);
    expect(display.fallbackRateCents).toBeUndefined();
  });
});
