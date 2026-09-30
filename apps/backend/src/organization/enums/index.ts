import { registerEnumType } from '@nestjs/graphql';

export enum OrganizationUnitAutomationKind {
  PAUSE_APPROVAL = 'PAUSE_APPROVAL',
  URGENT_CALL = 'URGENT_CALL',
  DISCOVERY_EMAIL = 'DISCOVERY_EMAIL',
}

registerEnumType(OrganizationUnitAutomationKind, {
  name: 'OrganizationUnitAutomationKind',
});

export const ALL_ORGANIZATION_UNIT_AUTOMATION_KINDS: readonly OrganizationUnitAutomationKind[] =
  [
    OrganizationUnitAutomationKind.PAUSE_APPROVAL,
    OrganizationUnitAutomationKind.URGENT_CALL,
    OrganizationUnitAutomationKind.DISCOVERY_EMAIL,
  ];
