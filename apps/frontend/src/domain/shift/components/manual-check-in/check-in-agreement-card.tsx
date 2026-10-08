'use client';

import { FileBadge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { resolveAgreementTrigger } from '../../check-in-agreement';
import { BlockerCard } from './blocker-card';

type AgreementData = {
  status: import('@repo/data').AgreementStatus;
  reimbursementTypeName?: string | null;
  contractId?: string | null;
  canManageAgreements: boolean;
  managerNames: string[];
};

type CheckInAgreementCardProps = {
  agreement: AgreementData;
  orgUId: string;
};

export function CheckInAgreementCard({
  agreement,
  orgUId,
}: CheckInAgreementCardProps) {
  const t = useTranslations('CheckIn');

  const trigger = resolveAgreementTrigger(agreement);
  if (!trigger) return null;

  const { severity, kind, hasAction } = trigger;
  const reimbursementType = agreement.reimbursementTypeName ?? '';

  const admins =
    agreement.managerNames.length <= 1
      ? (agreement.managerNames[0] ?? '')
      : t('agreementColleagues', { name: agreement.managerNames[0] ?? '' });

  const borderClass =
    severity === 'error' ? 'border-destructive' : 'border-alert';

  if (kind === 'noTemplate') {
    return (
      <BlockerCard
        icon={<FileBadge className="size-5" />}
        title={t('agreementNoTemplateTitle')}
        description={
          hasAction
            ? t('agreementNoTemplateManageBody')
            : t('agreementNoTemplateNoRightsBody', {
                reimbursementType,
                admins,
              })
        }
        buttonLabel={hasAction ? t('agreementSetUpTemplateButton') : undefined}
        actionHref={
          hasAction
            ? `/admin/${orgUId}/accounting/settings/templates`
            : undefined
        }
        actionExternal={hasAction}
        className={borderClass}
      />
    );
  }

  if (kind === 'noContract') {
    return (
      <BlockerCard
        icon={<FileBadge className="size-5" />}
        title={t('agreementNoContractTitle')}
        description={
          hasAction
            ? t('agreementNoContractManageBody', { reimbursementType })
            : t('agreementNoContractNoRightsBody', {
                reimbursementType,
                admins,
              })
        }
        buttonLabel={hasAction ? t('agreementCreateButton') : undefined}
        actionHref={
          hasAction ? `/admin/${orgUId}/accounting/reimbursements` : undefined
        }
        actionExternal={hasAction}
        className={borderClass}
      />
    );
  }

  if (kind === 'awaitingCountersign') {
    return (
      <BlockerCard
        icon={<FileBadge className="size-5" />}
        title={t('agreementAwaitingCountersignTitle')}
        description={
          hasAction
            ? t('agreementAwaitingCountersignManageBody', { reimbursementType })
            : t('agreementAwaitingCountersignNoRightsBody', {
                reimbursementType,
                admins,
              })
        }
        buttonLabel={hasAction ? t('agreementCountersignButton') : undefined}
        actionHref={
          hasAction ? `/admin/${orgUId}/accounting/reimbursements` : undefined
        }
        actionExternal={hasAction}
        className={borderClass}
      />
    );
  }

  return (
    <BlockerCard
      icon={<FileBadge className="size-5" />}
      title={t('agreementAwaitingVolunteerTitle')}
      description={t('agreementAwaitingVolunteerBody', { reimbursementType })}
      className={borderClass}
    />
  );
}
