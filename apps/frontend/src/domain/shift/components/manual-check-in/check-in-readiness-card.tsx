'use client';

import { Building2, Clock, LogOut, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  alreadyCheckedInDecideHref,
  type CheckInReadinessState,
} from '../../check-in-readiness';
import { BlockerCard } from './blocker-card';
import { ReadyBanner } from './ready-banner';

type CheckInReadinessCardProps = {
  state: CheckInReadinessState;
  checkInId: string;
  unitName: string;
  /** `null` while the required forms are unknown (loading or errored). */
  missingFormCount: number | null;
  profileHref: string | null;
  onInviteToOrg: () => void;
  isInviteToOrgPending: boolean;
  isInviteToOrgSent: boolean;
  onOpenAcceptMembership: () => void;
  onAddToShift: () => void;
  isAddToShiftPending: boolean;
};

export function CheckInReadinessCard({
  state,
  checkInId,
  unitName,
  missingFormCount,
  profileHref,
  onInviteToOrg,
  isInviteToOrgPending,
  isInviteToOrgSent,
  onOpenAcceptMembership,
  onAddToShift,
  isAddToShiftPending,
}: CheckInReadinessCardProps) {
  const t = useTranslations('CheckIn');
  const router = useRouter();

  if (state === 'ready') {
    return <ReadyBanner />;
  }

  if (state === 'alreadyCheckedIn') {
    return (
      <BlockerCard
        icon={<LogOut className="size-5" />}
        title={t('alreadyCheckedInTitle')}
        description={t('alreadyCheckedInDescription')}
        buttonLabel={t('alreadyCheckedInButton')}
        onAction={() => router.push(alreadyCheckedInDecideHref(checkInId))}
        className="border-destructive"
      />
    );
  }

  if (state === 'notMember') {
    return (
      <BlockerCard
        icon={<Building2 className="size-5" />}
        title={t('notMemberTitle', { unit: unitName })}
        description={t('notMemberDescription', { unit: unitName })}
        buttonLabel={t('notMemberButton', { unit: unitName })}
        onAction={onInviteToOrg}
        isActionPending={isInviteToOrgPending}
        isActionDone={isInviteToOrgSent}
        doneLabel={t('inviteSentWaiting')}
        truncateButtonLabel
        className="border-destructive"
      />
    );
  }

  if (state === 'pendingMembership') {
    // The forms gate fails closed: until they are known, offer no accept.
    if (missingFormCount === null) {
      return (
        <BlockerCard
          icon={<Clock className="size-5" />}
          title={t('pendingMembershipTitle', { unit: unitName })}
          description={t('requiredFormsChecking')}
          className="border-destructive"
        />
      );
    }

    // Open required forms block the accept, and only the volunteer can fill
    // them: point the admin at the profile (when they may see it) instead of
    // offering a button that cannot succeed.
    if (missingFormCount > 0) {
      return (
        <BlockerCard
          icon={<Clock className="size-5" />}
          title={t('pendingMembershipTitle', { unit: unitName })}
          description={
            <>
              <p>{t('requiredFormsOpen', { count: missingFormCount })}</p>
              {profileHref ? (
                <a
                  href={profileHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {t('openVolunteerProfile')}
                </a>
              ) : (
                <p>{t('askVolunteerToCompleteForms')}</p>
              )}
            </>
          }
          className="border-destructive"
        />
      );
    }

    return (
      <BlockerCard
        icon={<Clock className="size-5" />}
        title={t('pendingMembershipTitle', { unit: unitName })}
        description={t('pendingMembershipDescription')}
        buttonLabel={t('acceptMembershipButton')}
        onAction={onOpenAcceptMembership}
        className="border-destructive"
      />
    );
  }

  return (
    <BlockerCard
      icon={<UserX className="size-5" />}
      title={t('notInShiftTitle')}
      description={t('notInShiftDescription')}
      buttonLabel={t('addToShiftButton')}
      onAction={onAddToShift}
      isActionPending={isAddToShiftPending}
      className="border-destructive"
    />
  );
}
