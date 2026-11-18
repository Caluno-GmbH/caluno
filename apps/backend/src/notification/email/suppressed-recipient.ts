/** Accounts on this domain are internal and must never receive email. */
export const SUPPRESSED_EMAIL_DOMAIN = 'caluno.internal' as const;

export function isSuppressedEmailRecipient(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${SUPPRESSED_EMAIL_DOMAIN}`);
}
