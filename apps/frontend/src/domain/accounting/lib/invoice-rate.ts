/**
 * The hourly rate a coordinator may set for one timesheet, held as the string
 * they typed so a half-finished "12," survives a re-render.
 */

/** Whole cents as the field shows them: "1250" -> "12,50". */
export function formatRateInput(cents: number | undefined): string {
  return cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * A typed rate in euros ("12", "12,50", "12.50") as whole cents. Undefined
 * while the field is empty or half-typed, which leaves the organisation's own
 * rate in charge rather than briefly charging zero.
 */
export function parseRateCents(input: string | null): number | undefined {
  if (input === null) return undefined;
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return undefined;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros <= 0) return undefined;
  return Math.round(euros * 100);
}
