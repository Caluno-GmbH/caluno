import { z } from 'zod';

/**
 * Choice-field options render one control per option; an empty option can never
 * stay selected on the volunteer form, so each entry must be non-empty.
 */
export const choiceOptionSchema = z
  .string()
  .trim()
  .min(1, 'Option is required');

/** Unique non-empty options (compared after trim). */
export const choiceOptionsSchema = z
  .array(choiceOptionSchema)
  .superRefine((options, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (option) {
        if (seen.has(option)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Options must be unique',
            path: [i],
          });
        }
        seen.add(option);
      }
    }
  });

/** Indexes whose trimmed text appears more than once (empty entries ignored). */
export const duplicateOptionIndexes = (options: string[]): number[] => {
  const counts = new Map<string, number>();
  for (const option of options) {
    const key = option.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return options.flatMap((option, index) => {
    const key = option.trim();
    return key && (counts.get(key) ?? 0) > 1 ? [index] : [];
  });
};

/**
 * MULTI_CHOICE selections travel through the GraphQL `String` value channel as
 * a JSON-encoded array; commas in option values stay intact. Reads tolerate the
 * legacy comma-joined format (pre-refactor clients and in-flight submissions).
 */
export const serializeMultiChoiceValue = (values: string[]): string =>
  JSON.stringify(values);

export const parseMultiChoiceValue = (raw: string): string[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // legacy comma-joined format — fall through
  }
  return raw.split(',');
};
