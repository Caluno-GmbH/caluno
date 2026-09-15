import type { RawEffectiveRate } from '@repo/data/react';

export interface RateDisplay {
  /** The rate that applies in this unit, in cents. */
  rateCents: number;
  /**
   * The rate this unit would fall back to — its parent's, or the platform
   * default at the top. Only set when the unit overrides that fallback, so a
   * value shown here always differs from what the unit inherits.
   */
  fallbackRateCents?: number;
}

/**
 * Splits an effective rate into what to show and what, if anything, it
 * overrides. The fallback is the inherited rate rather than the platform
 * default: a sub-org inherits its parent's rate, not the built-in 5/8 €.
 */
export function resolveRateDisplay({
  effectiveRate,
  platformDefaultRateCents,
  organizationUnitId,
}: {
  effectiveRate?: RawEffectiveRate;
  platformDefaultRateCents: number;
  organizationUnitId: string;
}): RateDisplay {
  if (!effectiveRate) {
    return { rateCents: platformDefaultRateCents };
  }

  const isOwnRate =
    effectiveRate.isOverride &&
    effectiveRate.organizationUnitId === organizationUnitId;

  return {
    rateCents: effectiveRate.hourlyRateCents,
    fallbackRateCents: isOwnRate ? effectiveRate.inheritedRateCents : undefined,
  };
}
