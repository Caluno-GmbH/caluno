export const PAYMENT_DATA_MASKS = {
  iban: 'XXXX XXXX XXXX XXXX XXXX XX',
  bic: 'XXXXXXXXXXX',
} as const;

export function maskRestrictedPaymentData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const masked = { ...data };
  for (const [key, mask] of Object.entries(PAYMENT_DATA_MASKS)) {
    const value = masked[key];
    if (typeof value === 'string' && value.trim() !== '') {
      masked[key] = mask;
    }
  }
  return masked;
}
