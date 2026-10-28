/** Longest description of the `tasks` manual field, in characters. */
export const TASK_DESCRIPTION_MAX_LENGTH = 300;

/** Character limits per manual field id; fields not listed are unlimited. */
export const MANUAL_FIELD_MAX_LENGTH: Readonly<Record<string, number>> = {
  tasks: TASK_DESCRIPTION_MAX_LENGTH,
};

export function manualFieldMaxLength(fieldId: string): number | undefined {
  return Object.hasOwn(MANUAL_FIELD_MAX_LENGTH, fieldId)
    ? MANUAL_FIELD_MAX_LENGTH[fieldId]
    : undefined;
}

export function exceedsManualFieldLimit(
  fieldId: string,
  value: string,
): boolean {
  const max = manualFieldMaxLength(fieldId);
  return max !== undefined && value.length > max;
}
