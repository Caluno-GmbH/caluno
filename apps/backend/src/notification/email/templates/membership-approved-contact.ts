import type { MembershipApprovedContactPayload } from '../../payloads/membership-approved.payload';

export type WelcomeEmailContact = MembershipApprovedContactPayload;

export function hasWelcomeEmailContactSection(
  contact: WelcomeEmailContact | null | undefined,
): boolean {
  if (!contact) {
    return false;
  }

  return Boolean(
    contact.contactPersonName?.trim() ||
      contact.contactEmail?.trim() ||
      contact.phone?.trim(),
  );
}
