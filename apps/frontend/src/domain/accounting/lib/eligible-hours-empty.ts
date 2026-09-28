export type EligibleHoursEmptyReason<K extends string = string> =
  | { kind: 'outside-period'; count: number }
  | { kind: 'other-type'; reimbursementTypeKeys: K[] }
  | { kind: 'nothing-tracked' };

/**
 * Why the Eligible hours list is empty, so the dialog can say what to change
 * instead of showing a blank area. Null while there are hours to list or the
 * inputs are still loading.
 */
export function eligibleHoursEmptyReason<K extends string>(input: {
  listedCount: number | undefined;
  anyPeriodCount: number | undefined;
  otherTypeKeysInPeriod: K[] | undefined;
}): EligibleHoursEmptyReason<K> | null {
  const { listedCount, anyPeriodCount, otherTypeKeysInPeriod } = input;
  if (listedCount === undefined || listedCount > 0) return null;
  if (anyPeriodCount === undefined || otherTypeKeysInPeriod === undefined) {
    return null;
  }
  if (anyPeriodCount > 0) {
    return { kind: 'outside-period', count: anyPeriodCount };
  }
  if (otherTypeKeysInPeriod.length > 0) {
    return {
      kind: 'other-type',
      reimbursementTypeKeys: [...new Set(otherTypeKeysInPeriod)],
    };
  }
  return { kind: 'nothing-tracked' };
}
