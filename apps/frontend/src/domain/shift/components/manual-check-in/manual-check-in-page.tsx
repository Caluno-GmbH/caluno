'use client';

import {
  type CheckInContextData,
  useCheckInShiftInstances,
} from '@repo/data/react';
import { Button, Card, CardContent } from '@repo/ui';
import { endOfMonth, startOfMonth } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { resolveAgreementTrigger } from '../../check-in-agreement';
import { shouldShowIdVerification } from '../../check-in-readiness';
import {
  applyDate,
  applyOrgUnit,
  applyShift,
  applyShiftInstance,
  type CheckInSelection,
  pickInitialInstance,
  toCheckInInstance,
} from '../../check-in-selection';
import { pendingVolunteerProfileHref } from '../../routes';
import { AddToShiftOverCapacityDialog } from './add-to-shift-over-capacity-dialog';
import { CheckInAgreementCard } from './check-in-agreement-card';
import { CheckInReadinessCard } from './check-in-readiness-card';
import { CheckInVolunteerIdentity } from './check-in-volunteer-identity';
import { CheckInWithoutShiftWarningCard } from './check-in-without-shift-warning-card';
import { DateSheet } from './date-sheet';
import { IdVerificationCard } from './id-verification-card';
import { OrgUnitSheet } from './org-unit-sheet';
import { ShiftInstanceStepper } from './shift-instance-stepper';
import { ShiftSheet } from './shift-sheet';
import { shouldShowShiftlessCheckInWarning } from './shiftless-check-in-warning';
import { UnverifiedCheckInDialog } from './unverified-check-in-dialog';
import { useCheckInLiveReadiness } from './use-check-in-live-readiness';
import { useCheckInReadinessActions } from './use-check-in-readiness-actions';
import { useCheckInSubmit } from './use-check-in-submit';

type ManualCheckInPageProps = {
  checkInId: string;
  initialContext: CheckInContextData;
  orgUnits: Array<{ id: string; name: string }>;
  initialOrgUnitId: string;
};

export function ManualCheckInPage({
  checkInId,
  initialContext,
  orgUnits,
  initialOrgUnitId,
}: ManualCheckInPageProps) {
  const t = useTranslations('CheckIn');
  const router = useRouter();

  const [selection, setSelection] = useState<CheckInSelection>(() => ({
    orgUnitId: initialOrgUnitId,
    date: new Date(),
    shiftId: null,
    shiftInstanceId: null,
    selectedInstance: null,
  }));
  const [didPreselect, setDidPreselect] = useState(false);
  const [withoutShift, setWithoutShift] = useState(false);
  const [openSheet, setOpenSheet] = useState<
    'orgUnit' | 'date' | 'shift' | null
  >(null);

  // The visible month drives the fetch; it also feeds the calendar dots and
  // the day list, so one range query serves every consumer on the page.
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  const { data: rawInstances, isPlaceholderData: instancesStale } =
    useCheckInShiftInstances(
      selection.orgUnitId,
      startOfMonth(visibleMonth),
      endOfMonth(visibleMonth),
    );

  const instances = useMemo(
    () => (rawInstances ?? []).map(toCheckInInstance),
    [rawInstances],
  );

  // Preselect the instance nearest to now, once, after the first load —
  // unless the user already chose without-assignment.
  if (!didPreselect && rawInstances && !withoutShift) {
    setDidPreselect(true);
    const initial = pickInitialInstance(instances, new Date());
    if (initial) {
      setSelection((current) => ({ ...current, ...initial }));
    }
  }

  // Every mutator in check-in-selection.ts writes shiftInstanceId and
  // selectedInstance together, so they never disagree about which instance
  // is current.
  const {
    volunteer,
    readiness,
    readinessState,
    membershipRequest,
    missingFormCount,
    isPollExpired,
    refresh,
  } = useCheckInLiveReadiness({
    checkInId,
    initialContext,
    orgUnitId: selection.orgUnitId,
    shiftInstanceId: selection.shiftInstanceId,
    withoutShift,
  });

  // Without a shift there is nothing to be ready *for*, so the card earns its
  // place only while it is blocking: not a member, or a membership request
  // still waiting on an admin. The green ready banner stays hidden there.
  // With a shift, the membership blockers show as well as the shift-scoped
  // states once an instance is chosen.
  const showReadinessCard =
    readinessState === 'notMember' ||
    readinessState === 'pendingMembership' ||
    (!withoutShift && !!selection.shiftInstanceId);

  // Informational only: never gates the check-in button, unlike the
  // readiness card, which only earns its place while it blocks.
  const showShiftlessWarning = shouldShowShiftlessCheckInWarning(withoutShift);

  // The ID verification card is a read-only side output of the readiness
  // facts: it never blocks check-in, and disappears for good once verified.
  const showIdVerification =
    readinessState && readiness
      ? shouldShowIdVerification({
          state: readinessState,
          idVerificationEnabled: readiness.idVerificationEnabled,
          idVerified: readiness.idVerified,
          membershipId: readiness.membershipId ?? null,
        })
      : false;

  const actions = useCheckInReadinessActions({
    checkInId,
    orgUnitId: selection.orgUnitId,
    shiftInstanceId: selection.shiftInstanceId,
    membershipRequestId: membershipRequest?.id ?? null,
    shiftHasAvailableSeat: readiness?.shiftHasAvailableSeat ?? false,
  });

  const unitName =
    orgUnits.find((unit) => unit.id === selection.orgUnitId)?.name ?? '';
  const profileHref =
    readiness?.canViewVolunteerProfile && volunteer
      ? pendingVolunteerProfileHref(selection.orgUnitId, volunteer.id)
      : null;

  const [showUnverifiedConfirm, setShowUnverifiedConfirm] = useState(false);

  const agreementTrigger =
    readinessState === 'ready'
      ? resolveAgreementTrigger(readiness?.agreement)
      : null;

  // Holds back the green ready banner when a side-check (agreement/ID) is still open.
  const hasOutstandingReadyCheck = !!agreementTrigger || showIdVerification;

  const {
    startTime,
    changeStartTime,
    startTimeError,
    submit,
    isSubmitPending,
  } = useCheckInSubmit({ selection, volunteer });

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft />
          </Button>
          <h1 className="flex-1 text-center text-lg font-bold">
            {t('checkInRunningTitle')}
          </h1>
          <div className="size-9 shrink-0" />
        </div>

        <ShiftInstanceStepper
          selection={selection}
          orgUnits={orgUnits}
          withoutShift={withoutShift}
          onOpenOrgUnit={() => setOpenSheet('orgUnit')}
          onOpenDate={() => {
            setVisibleMonth(selection.date ?? new Date());
            setOpenSheet('date');
          }}
          onOpenShift={() => setOpenSheet('shift')}
          startTime={startTime}
          onStartTimeChange={changeStartTime}
          startTimeError={startTimeError}
        />

        <CheckInVolunteerIdentity volunteer={volunteer} />

        {showShiftlessWarning && <CheckInWithoutShiftWarningCard />}

        {showReadinessCard &&
          readinessState &&
          !(readinessState === 'ready' && hasOutstandingReadyCheck) && (
            <CheckInReadinessCard
              state={readinessState}
              checkInId={checkInId}
              unitName={unitName}
              volunteerName={volunteer?.name ?? null}
              membershipRequest={
                membershipRequest && {
                  // A pending request may target an ancestor of the
                  // selected unit.
                  organizationUnitName:
                    membershipRequest.organizationUnitName ?? unitName,
                  canAccept: membershipRequest.canAccept,
                }
              }
              missingFormCount={missingFormCount}
              profileHref={profileHref}
              onInviteToOrg={actions.inviteToOrg}
              isInviteToOrgPending={actions.isInviteToOrgPending}
              isInviteToOrgSent={actions.isInviteToOrgSent}
              onAcceptMembership={actions.acceptMembership}
              isAcceptMembershipPending={actions.isAcceptMembershipPending}
              onAddToShift={actions.requestAddToShift}
              isAddToShiftPending={actions.isAddToShiftPending}
            />
          )}

        {isPollExpired && (
          <Button type="button" variant="outline" onClick={refresh}>
            {t('pollExpiredButton')}
          </Button>
        )}

        {showIdVerification && readiness?.membershipId && (
          <IdVerificationCard
            organizationUnitId={selection.orgUnitId}
            membershipId={readiness.membershipId}
          />
        )}

        {readinessState === 'ready' &&
          agreementTrigger &&
          readiness?.agreement && (
            <CheckInAgreementCard
              agreement={readiness.agreement}
              orgUId={selection.orgUnitId}
            />
          )}

        {readinessState === 'ready' &&
          (agreementTrigger ? (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              disabled={isSubmitPending || !volunteer}
              onClick={() => setShowUnverifiedConfirm(true)}
            >
              {t('unverifiedCheckInButton')}
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              variant={
                showIdVerification && readiness?.membershipId
                  ? 'outline'
                  : 'default'
              }
              className="w-full"
              disabled={isSubmitPending || !volunteer}
              onClick={submit}
            >
              {t('checkInButton')}
            </Button>
          ))}

        <UnverifiedCheckInDialog
          open={showUnverifiedConfirm}
          onOpenChange={setShowUnverifiedConfirm}
          onConfirm={() => {
            setShowUnverifiedConfirm(false);
            submit();
          }}
          isPending={isSubmitPending}
        />

        {volunteer && (
          <AddToShiftOverCapacityDialog
            {...actions.overCapacityConfirm}
            volunteerName={volunteer.name}
            isPending={actions.isAddToShiftPending}
          />
        )}

        <OrgUnitSheet
          open={openSheet === 'orgUnit'}
          onOpenChange={(open) => setOpenSheet(open ? 'orgUnit' : null)}
          orgUnits={orgUnits}
          selectedOrgUnitId={selection.orgUnitId}
          onSelect={(orgUnitId) =>
            setSelection((current) => applyOrgUnit(current, orgUnitId))
          }
        />

        <DateSheet
          open={openSheet === 'date'}
          onOpenChange={(open) => setOpenSheet(open ? 'date' : null)}
          instances={instances}
          selectedDate={selection.date}
          selectedShiftId={selection.shiftId}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          isLoadingInstances={instancesStale}
          onSelect={(date) =>
            setSelection((current) =>
              applyDate(current, date, instances, new Date()),
            )
          }
        />

        <ShiftSheet
          open={openSheet === 'shift'}
          onOpenChange={(open) => setOpenSheet(open ? 'shift' : null)}
          orgUnitId={selection.orgUnitId}
          instances={instances}
          selectedDate={selection.date}
          selectedShiftInstanceId={selection.shiftInstanceId}
          withoutShift={withoutShift}
          onSelectInstance={(instance) => {
            // Instances are stale while the range query is in flight —
            // applying one would resolve against the wrong month.
            if (instancesStale) return;
            setWithoutShift(false);
            setSelection((current) => applyShiftInstance(current, instance));
          }}
          onSelectShift={(shiftId) => {
            if (instancesStale) return;
            setWithoutShift(false);
            setSelection((current) =>
              applyShift(current, shiftId, instances, new Date()),
            );
          }}
          onSelectWithoutShift={() => {
            setWithoutShift(true);
            setSelection((current) => ({
              ...current,
              shiftId: null,
              shiftInstanceId: null,
              selectedInstance: null,
            }));
          }}
        />
      </CardContent>
    </Card>
  );
}
