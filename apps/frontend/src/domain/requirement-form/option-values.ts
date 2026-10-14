import { z } from 'zod';

/**
 * Choice-field options render one control per option; an empty option can never
 * stay selected on the volunteer form, so each entry must be non-empty.
 */
export const choiceOptionSchema = z
  .string()
  .trim()
  .min(1, 'Option is required');

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
