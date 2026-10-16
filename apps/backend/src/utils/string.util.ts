export const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';

export const trimmed = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
