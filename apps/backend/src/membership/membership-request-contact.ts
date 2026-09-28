import type { UserEntity } from '../auth/schemas/auth.schema';
import type { OrganizationUnitEntity } from '../organization/schemas/organization-unit.schema';
import type { MembershipRequestContact } from './models/membership-request-contact.model';

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function hasConfiguredOrgUnitContact(
  unit: Pick<
    OrganizationUnitEntity,
    'contactPersonName' | 'contactEmail' | 'phone'
  >,
): boolean {
  return Boolean(
    trimOrNull(unit.contactPersonName) ||
      trimOrNull(unit.contactEmail) ||
      trimOrNull(unit.phone),
  );
}

export function orgUnitContactFromEntity(
  unit: Pick<
    OrganizationUnitEntity,
    'contactPersonName' | 'contactEmail' | 'phone'
  >,
): MembershipRequestContact {
  return {
    name: trimOrNull(unit.contactPersonName),
    email: trimOrNull(unit.contactEmail),
    phone: trimOrNull(unit.phone),
  };
}

export function adminContactFromUser(
  user: Pick<UserEntity, 'name' | 'email'>,
): MembershipRequestContact {
  return {
    name: user.name,
    email: user.email,
    phone: null,
  };
}

export function orgUnitWelcomeContactFromEntity(
  unit: Pick<
    OrganizationUnitEntity,
    'contactPersonName' | 'contactEmail' | 'phone' | 'welcomeMessage'
  >,
) {
  return {
    contactPersonName: trimOrNull(unit.contactPersonName),
    contactEmail: trimOrNull(unit.contactEmail),
    phone: trimOrNull(unit.phone),
    welcomeMessage: trimOrNull(unit.welcomeMessage),
  };
}
