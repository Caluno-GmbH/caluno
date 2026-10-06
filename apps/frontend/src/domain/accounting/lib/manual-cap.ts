import { centsToEuros, eurosToCents } from './money';

/** The manually-set initial cap amount in euros; a missing baseline reads as zero. */
export function initialCapAmountEuros(
  amountCents: number | null | undefined,
): number {
  return centsToEuros(amountCents ?? 0);
}

/** Parses a user-entered euro amount (comma or dot decimal) into whole cents; null when unparseable or negative. */
export function parseEuroInputToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return eurosToCents(euros);
}

/** The projected year-to-date cap amount after this invoice. */
export function projectedCapAmount(
  usedBefore: number,
  selectedAmount: number,
): number {
  return usedBefore + selectedAmount;
}

/**
 * The used-before figure with the coordinator's not-yet-saved initial amount
 * folded in, so the cap card and the projection reflect the edit before the
 * timesheet is sent. The stored `usedBefore` already includes the saved
 * baseline, so only the difference is applied.
 */
export function effectiveUsedBefore(
  usedBefore: number,
  pendingAmountCents: number | null,
  existingAmountCents: number | null | undefined,
): number {
  if (pendingAmountCents === null) return usedBefore;
  const deltaCents = pendingAmountCents - (existingAmountCents ?? 0);
  return usedBefore + centsToEuros(deltaCents);
}
