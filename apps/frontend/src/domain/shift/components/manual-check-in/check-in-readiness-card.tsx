'use client';

import { Building2, Clock, LogOut, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  alreadyCheckedInDecideHref,
  type CheckInReadinessState,
  resolvePendingMembershipView,
} from '../../check-in-readiness';
import { BlockerCard } from './blocker-card';
import { ReadyBanner } from './ready-banner';

type CheckInReadinessCardProps = {
  state: CheckInReadinessState;
  checkInId: string;
  unitName: string;
  /**
   * The volunteer's full name, or `null` while they are unrelated to the
   * caller (no identity reaches the DOM until they send a request).
   */
  volunteerName: string | null;
  /**
   * The open membership request, or `null` without one. Its unit is the
   * selected unit or an ancestor of it and names the pending-membership card;
   * `canAccept` is whether the caller manages that unit.
   */
  membershipRequest: {
    organizationUnitName: string;
    canAccept: boolean;
  } | null;
  /** `null` while the required forms are unknown (loading or errored). */
  missingFormCount: number | null;
  profileHref: string | null;
  onInviteToOrg: () => void;
  isInviteToOrgPending: boolean;
  isInviteToOrgSent: boolean;
  onAcceptMembership: () => void;
  isAcceptMembershipPending: boolean;
  onAddToShift: () => void;
  isAddToShiftPending: boolean;
};

export function CheckInReadinessCard({
  state,
  checkInId,
  unitName,
  volunteerName,
  membershipRequest,
  missingFormCount,
  profileHref,
  onInviteToOrg,
  isInviteToOrgPending,
  isInviteToOrgSent,
  onAcceptMembership,
  isAcceptMembershipPending,
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
        buttonLabel={t('notMemberButton')}
        onAction={onInviteToOrg}
        isActionPending={isInviteToOrgPending}
        isActionDone={isInviteToOrgSent}
        doneLabel={t('inviteSent')}
        doneDescription={t('inviteSentDescription')}
        actionAriaLabel={t('notMemberButtonAria', { unit: unitName })}
        className="border-destructive"
      />
    );
  }

  if (state === 'pendingMembership') {
    const requestUnitName = membershipRequest?.organizationUnitName ?? unitName;
    const title = volunteerName
      ? t('pendingMembershipTitleNamed', {
          name: volunteerName,
          unit: requestUnitName,
        })
      : t('pendingMembershipTitle', { unit: requestUnitName });
    const view = resolvePendingMembershipView({
      canAccept: membershipRequest?.canAccept ?? false,
      missingFormCount,
    });

    // A check-in desk may only grant membership in units it manages: a
    // request to an unmanaged ancestor gets no accept and no forms UX.
    if (view === 'requiresUnitManager') {
      return (
        <BlockerCard
          icon={<Clock className="size-5" />}
          title={title}
          description={t('acceptRequiresUnitManager', {
            unit: requestUnitName,
          })}
          className="border-destructive"
        />
      );
    }

    // The forms gate fails closed: until they are known, offer no accept.
    if (view === 'checkingForms') {
      return (
        <BlockerCard
          icon={<Clock className="size-5" />}
          title={title}
          description={t('requiredFormsChecking')}
          className="border-destructive"
        />
      );
    }

    // Open required forms block the accept, and only the volunteer can fill
    // them: point the admin at the profile (when they may see it) instead of
    // offering a button that cannot succeed.
    if (view === 'formsOpen') {
      return (
        <BlockerCard
          icon={<Clock className="size-5" />}
          title={title}
          description={
            <>
              <p>{t('requiredFormsOpen', { count: missingFormCount ?? 0 })}</p>
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
        title={title}
        description={t('pendingMembershipDescription')}
        buttonLabel={t('acceptMembershipButton')}
        onAction={onAcceptMembership}
        isActionPending={isAcceptMembershipPending}
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
