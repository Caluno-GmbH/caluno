export const isBlank = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '';
