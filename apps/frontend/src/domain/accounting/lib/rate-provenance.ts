import type { RawEffectiveRate } from '@repo/data/react';

/**
 * Where the rate a unit shows came from:
 * - `own` — this unit set it, replacing `fallbackRateCents`
 * - `inherited` — it comes from the ancestor named in `sourceName`
 * - `none` — the platform default, or an inherited value with no unit to
 *   attribute it to (the org-wide row belongs to no unit)
 */
export type RateProvenance =
  | { kind: 'own'; fallbackRateCents: number }
  | { kind: 'inherited'; sourceName: string }
  | { kind: 'none' };

export interface RateDisplay {
  /** The rate that applies in this unit, in cents. */
  rateCents: number;
  provenance: RateProvenance;
}

export function resolveRateDisplay({
  effectiveRate,
  platformDefaultRateCents,
}: {
  effectiveRate?: RawEffectiveRate;
  platformDefaultRateCents: number;
}): RateDisplay {
  if (!effectiveRate) {
    return {
      rateCents: platformDefaultRateCents,
      provenance: { kind: 'none' },
    };
  }

  const { hourlyRateCents, isOwnRate, fallbackRateCents, sourceUnitName } =
    effectiveRate;

  if (isOwnRate) {
    return {
      rateCents: hourlyRateCents,
      provenance:
        // An override can be set to the very rate it replaces. Naming the
        // fallback then adds nothing, so the row stays on one line.
        fallbackRateCents === hourlyRateCents
          ? { kind: 'none' }
          : { kind: 'own', fallbackRateCents },
    };
  }

  return {
    rateCents: hourlyRateCents,
    provenance: sourceUnitName
      ? { kind: 'inherited', sourceName: sourceUnitName }
      : { kind: 'none' },
  };
}
