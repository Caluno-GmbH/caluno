/** `internal` and any `*.internal` domain are internal infrastructure and must never receive email. */
const SUPPRESSED_EMAIL_DOMAIN_PATTERN = /@(?:[^@\s]+\.)?internal$/i;

export function isSuppressedEmailRecipient(email: string): boolean {
  return SUPPRESSED_EMAIL_DOMAIN_PATTERN.test(email.trim());
}
