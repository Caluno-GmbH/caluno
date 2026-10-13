import { AgreementStatus } from '@repo/data';

export type AgreementTrigger = {
  severity: 'error' | 'warning';
  kind:
    | 'noTemplate'
    | 'noContract'
    | 'awaitingCountersign'
    | 'awaitingVolunteerSign';
  hasAction: boolean;
};

export function resolveAgreementTrigger(
  agreement:
    | { status: AgreementStatus; canManageAgreements: boolean }
    | null
    | undefined,
): AgreementTrigger | null {
  if (!agreement) return null;

  const { status, canManageAgreements } = agreement;

  if (
    status === AgreementStatus.Active ||
    status === AgreementStatus.NotApplicable
  ) {
    return null;
  }

  if (status === AgreementStatus.NoTemplate) {
    return {
      severity: 'error',
      kind: 'noTemplate',
      hasAction: canManageAgreements,
    };
  }

  if (status === AgreementStatus.NoContract) {
    return {
      severity: 'warning',
      kind: 'noContract',
      hasAction: canManageAgreements,
    };
  }

  if (status === AgreementStatus.AwaitingCountersignature) {
    return {
      severity: 'warning',
      kind: 'awaitingCountersign',
      hasAction: canManageAgreements,
    };
  }

  if (status === AgreementStatus.AwaitingVolunteerSignature) {
    return {
      severity: 'warning',
      kind: 'awaitingVolunteerSign',
      hasAction: false,
    };
  }

  return null;
}
