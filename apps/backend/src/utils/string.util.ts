export const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';

export const trimmed = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Wraps `value` as a `%…%` LIKE/ILIKE pattern, escaping `\`, `%` and `_` so
 * user input matches literally (Postgres' default LIKE escape is `\`). */
export const containsPattern = (value: string): string =>
  `%${value.replace(/[\\%_]/g, '\\$&')}%`;
