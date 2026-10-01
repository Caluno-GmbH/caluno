import { isBlank } from '../utils';

export const PAYMENT_DATA_MASKS = {
  iban: 'XXXX XXXX XXXX XXXX XXXX XX',
  bic: 'XXXXXXXXXXX',
  'account-holder': 'XXXXXX XXXXXX',
} as const;

export const PAYMENT_USER_FIELD_MASKS = {
  iban: PAYMENT_DATA_MASKS.iban,
  bic: PAYMENT_DATA_MASKS.bic,
  accountHolder: PAYMENT_DATA_MASKS['account-holder'],
} as const;

export function maskRestrictedPaymentData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const masked = { ...data };
  for (const [key, mask] of Object.entries(PAYMENT_DATA_MASKS)) {
    const value = masked[key];
    if (!isBlank(value)) {
      masked[key] = mask;
    }
  }
  return masked;
}

export function maskRestrictedPaymentUserFields<
  T extends {
    iban?: string | null;
    bic?: string | null;
    accountHolder?: string | null;
  },
>(user: T): T {
  const masked = { ...user };
  for (const [field, mask] of Object.entries(PAYMENT_USER_FIELD_MASKS) as Array<
    [keyof typeof PAYMENT_USER_FIELD_MASKS, string]
  >) {
    const value = masked[field];
    if (!isBlank(value)) {
      masked[field] = mask as T[typeof field];
    }
  }
  return masked;
}
