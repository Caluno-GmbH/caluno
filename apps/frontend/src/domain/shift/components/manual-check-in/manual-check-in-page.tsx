'use client';

import {
  type CheckInContextData,
  useCheckInAddToShiftInstance,
  useCheckInApproveMembershipRequest,
  useCheckInContext,
  useCheckInInviteToOrganization,
  useCheckInReadiness,
  useCheckInShiftInstances,
  useCheckInVolunteerRequiredForms,
  useQueryClient,
} from '@repo/data/react';
import { applyTimeToDate, Button, Card, CardContent } from '@repo/ui';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { UserCard } from '@/components/user-card';
import { checkInVolunteer } from '@/domain/time-entry/actions';
import { useRouter } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import { resolveAgreementTrigger } from '../../check-in-agreement';
import { isCheckInAwaitingVolunteer } from '../../check-in-polling';
import {
  countMissingRequiredForms,
  resolveCheckInReadiness,
  resolveVisibleCheckInReadiness,
  shouldShowIdVerification,
} from '../../check-in-readiness';
import {
  applyDate,
  applyOrgUnit,
  applyShift,
  applyShiftInstance,
  type CheckInSelection,
  pickInitialInstance,
  toCheckInInstance,
} from '../../check-in-selection';
import { setCheckInSuccessPayload } from '../../check-in-success-dialog';
import { volunteerProfileHref } from '../../routes';
import { AddToShiftOverCapacityDialog } from './add-to-shift-over-capacity-dialog';
import { CheckInAgreementCard } from './check-in-agreement-card';
import { CheckInReadinessCard } from './check-in-readiness-card';
import { CheckInWithoutShiftWarningCard } from './check-in-without-shift-warning-card';
import { DateSheet } from './date-sheet';
import { IdVerificationCard } from './id-verification-card';
import { OrgUnitSheet } from './org-unit-sheet';
import { ShiftInstanceStepper } from './shift-instance-stepper';
import { ShiftSheet } from './shift-sheet';
import { shouldShowShiftlessCheckInWarning } from './shiftless-check-in-warning';
import { UnrelatedVolunteerCard } from './unrelated-volunteer-card';
import { UnverifiedCheckInDialog } from './unverified-check-in-dialog';
import { useCheckInPollWindow } from './use-check-in-poll-window';

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
  const tValidation = useTranslations('TimeEntry.validation');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { formatDate, formatTimeRange, formatTimeRelativeToStart } =
    useFormatting();

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
  const [startTime, setStartTime] = useState(() => format(new Date(), 'HH:mm'));
  const [startTimeError, setStartTimeError] = useState<string | null>(null);

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

  // Context, readiness and required forms poll on one shared interval. The
  // poll window that decides it reads the query results, so its output is
  // mirrored into this state (adjusted during render, below) and read here.
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);

  // The context is seeded by the server render and re-fetched while polling,
  // so a volunteer who becomes related (sends a request) is revealed live.
  // `volunteer` stays null while unrelated: no identity reaches the DOM.
  const { data: liveContext } = useCheckInContext(checkInId, {
    initialData: initialContext,
    refetchInterval,
  });
  const context = liveContext ?? initialContext;
  const volunteer = context.volunteer;

  // Readiness always runs: with no instance chosen (or without-assignment)
  // the null instance returns only the membership facts, so a freshly
  // scanned volunteer can be invited before any shift is picked. The
  // shift-scoped states stay hidden until a choice is made (see
  // resolveVisibleCheckInReadiness). Every mutator in check-in-selection.ts
  // writes shiftInstanceId and selectedInstance together, so they never
  // disagree about which instance is current.
  const { data: readiness } = useCheckInReadiness(
    selection.orgUnitId,
    checkInId,
    selection.shiftInstanceId,
    { enabled: true, refetchInterval },
  );
  const readinessState = resolveVisibleCheckInReadiness(
    readiness
      ? resolveCheckInReadiness(
          {
            ...readiness,
            membershipRequest: readiness.membershipRequest ?? null,
          },
          { requiresShift: !withoutShift },
        )
      : null,
    { withoutShift, shiftInstanceId: selection.shiftInstanceId },
  );

  // Without a shift there is nothing to be ready *for*, so the card earns its
  // place only while it is blocking: not a member, or a membership request
  // still waiting on an admin. The green ready banner stays hidden there.
  // With a shift, the membership blockers show as well as the shift-scoped
  // states once an instance is chosen.
  const showReadinessCard =
    readinessState === 'notMember' ||
    readinessState === 'pendingMembership' ||
    (!withoutShift && !!selection.shiftInstanceId);

  // A check-in desk may only accept requests to units it manages; a request
  // to an unmanaged ancestor shows no accept and no forms.
  const canAcceptMembershipRequest =
    readiness?.membershipRequest?.canAccept ?? false;

  // Fetched while an acceptable request is pending, so a volunteer completing
  // the required forms on their device is noticed.
  // `null` while unknown (loading or errored) so the accept stays blocked.
  const { data: requiredForms, isError: isRequiredFormsError } =
    useCheckInVolunteerRequiredForms(
      selection.orgUnitId,
      checkInId,
      readinessState === 'pendingMembership' && canAcceptMembershipRequest,
      { refetchInterval },
    );
  const missingFormCount = countMissingRequiredForms({
    forms: requiredForms,
    isError: isRequiredFormsError,
  });

  // Polling runs while the admin waits on the volunteer, and the window
  // restarts whenever anything the page shows changes.
  const pollWindow = useCheckInPollWindow(
    isCheckInAwaitingVolunteer({
      isRelated: !!volunteer,
      state: readinessState,
    }),
    JSON.stringify([
      selection.orgUnitId,
      volunteer?.id ?? null,
      context.pendingOrganizationUnits.map((unit) => unit.id),
      readiness
        ? [
            readiness.isMember,
            readiness.isParticipating,
            readiness.hasOpenTimeEntry,
            readiness.shiftHasAvailableSeat,
            readiness.idVerified,
          ]
        : null,
      readiness?.membershipRequest ?? null,
      missingFormCount,
    ]),
  );
  if (pollWindow.refetchInterval !== refetchInterval) {
    setRefetchInterval(pollWindow.refetchInterval);
  }

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

  // "Sent" is per org unit — tracked as the id it was sent for, so switching
  // to a different unit re-arms the button instead of carrying a stale
  // confirmation forward.
  const [orgInviteSentFor, setOrgInviteSentFor] = useState<string | null>(null);
  const [showOverCapacityConfirm, setShowOverCapacityConfirm] = useState(false);
  const inviteToOrgMutation = useCheckInInviteToOrganization(
    selection.orgUnitId,
  );
  const addToShiftMutation = useCheckInAddToShiftInstance(selection.orgUnitId);
  const approveMembershipMutation = useCheckInApproveMembershipRequest(
    selection.orgUnitId,
  );

  const handleInviteToOrg = async () => {
    try {
      await inviteToOrgMutation.mutateAsync(checkInId);
      setOrgInviteSentFor(selection.orgUnitId);
    } catch {
      toast.error(t('notMemberError'));
    }
  };

  const handleAcceptMembership = async () => {
    const requestId = readiness?.membershipRequest?.id;
    if (!requestId) return;
    try {
      await approveMembershipMutation.mutateAsync(requestId);
    } catch {
      toast.error(t('acceptMembershipError'));
    }
  };

  const addToShift = async (allowOverCapacity: boolean) => {
    if (!selection.shiftInstanceId) return;
    try {
      await addToShiftMutation.mutateAsync({
        checkInId,
        shiftInstanceId: selection.shiftInstanceId,
        allowOverCapacity,
      });
    } catch {
      toast.error(t('addToShiftError'));
    }
  };

  // A full assignment needs an explicit "add anyway" before going over
  // capacity; with a free seat the volunteer is added straight away.
  const handleAddToShift = () => {
    if (readiness?.shiftHasAvailableSeat) {
      void addToShift(false);
    } else {
      setShowOverCapacityConfirm(true);
    }
  };

  const unitName =
    orgUnits.find((unit) => unit.id === selection.orgUnitId)?.name ?? '';
  // A pending request may target an ancestor of the selected unit.
  const requestUnitName =
    readiness?.membershipRequest?.organizationUnitName ?? unitName;
  const profileHref =
    readiness?.canViewVolunteerProfile && volunteer
      ? volunteerProfileHref(selection.orgUnitId, volunteer.id)
      : null;

  const [showUnverifiedConfirm, setShowUnverifiedConfirm] = useState(false);

  const agreementTrigger =
    readinessState === 'ready'
      ? resolveAgreementTrigger(readiness?.agreement)
      : null;

  // Holds back the green ready banner when a side-check (agreement/ID) is still open.
  const hasOutstandingReadyCheck = !!agreementTrigger || showIdVerification;

  const [isSubmitPending, startSubmitTransition] = useTransition();

  const handleSubmit = () => {
    // `ready` implies membership, so the volunteer is related and known; the
    // guard covers the poll gap before the context catches up.
    if (!volunteer) return;
    const startedAt = startTime
      ? applyTimeToDate(selection.date ?? new Date(), startTime)
      : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) {
      setStartTimeError(t('startTimeInvalid'));
      return;
    }

    // Ended shifts are listed and the start defaults to now, so a start past
    // the shift end is easy to hit. The backend rejects it; say so up front.
    if (selection.selectedInstance) {
      const shiftEnd = new Date(selection.selectedInstance.actualEndsAt);
      if (startedAt.getTime() > shiftEnd.getTime()) {
        setStartTimeError(
          tValidation('startAfterShiftEnd', {
            end: formatTimeRelativeToStart(shiftEnd, startedAt),
          }),
        );
        return;
      }
    }
    setStartTimeError(null);

    startSubmitTransition(async () => {
      const result = await checkInVolunteer({
        organizationUnitId: selection.orgUnitId,
        volunteerId: volunteer.id,
        shiftInstanceId: selection.shiftInstanceId,
        startedAt,
      });

      if (result?.serverError) {
        toast.error(result.serverError);
        await queryClient.invalidateQueries({
          queryKey: ['check-in-readiness'],
        });
        return;
      }

      const startsAt = selection.selectedInstance
        ? new Date(selection.selectedInstance.actualStartsAt)
        : null;
      const isToday =
        !!startsAt && startsAt.toDateString() === new Date().toDateString();

      setCheckInSuccessPayload({
        volunteerName: volunteer.name,
        volunteerImage: volunteer.image ?? null,
        shiftTitle: selection.selectedInstance?.title ?? null,
        timeRange: selection.selectedInstance
          ? formatTimeRange(
              selection.selectedInstance.actualStartsAt,
              selection.selectedInstance.actualEndsAt,
            )
          : null,
        dateLabel: startsAt
          ? isToday
            ? t('today')
            : formatDate(startsAt)
          : null,
      });
      router.push('/check-in');
    });
  };

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
          onStartTimeChange={(value) => {
            setStartTime(value);
            setStartTimeError(null);
          }}
          startTimeError={startTimeError}
        />

        {volunteer ? (
          <UserCard user={volunteer} size="lg" hideEmail />
        ) : (
          <UnrelatedVolunteerCard />
        )}

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
                readiness?.membershipRequest
                  ? {
                      organizationUnitName: requestUnitName,
                      canAccept: canAcceptMembershipRequest,
                    }
                  : null
              }
              missingFormCount={missingFormCount}
              profileHref={profileHref}
              onInviteToOrg={handleInviteToOrg}
              isInviteToOrgPending={inviteToOrgMutation.isPending}
              isInviteToOrgSent={orgInviteSentFor === selection.orgUnitId}
              onAcceptMembership={handleAcceptMembership}
              isAcceptMembershipPending={approveMembershipMutation.isPending}
              onAddToShift={handleAddToShift}
              isAddToShiftPending={addToShiftMutation.isPending}
            />
          )}

        {pollWindow.expired && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              pollWindow.restart();
              // Refresh now rather than one interval after the restart.
              void queryClient.invalidateQueries({
                queryKey: ['check-in-context', checkInId],
              });
              void queryClient.invalidateQueries({
                queryKey: [
                  'check-in-readiness',
                  selection.orgUnitId,
                  checkInId,
                ],
              });
              void queryClient.invalidateQueries({
                queryKey: [
                  'check-in-required-forms',
                  selection.orgUnitId,
                  checkInId,
                ],
              });
            }}
          >
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
              onClick={handleSubmit}
            >
              {t('checkInButton')}
            </Button>
          ))}

        <UnverifiedCheckInDialog
          open={showUnverifiedConfirm}
          onOpenChange={setShowUnverifiedConfirm}
          onConfirm={() => {
            setShowUnverifiedConfirm(false);
            handleSubmit();
          }}
          isPending={isSubmitPending}
        />

        {volunteer && (
          <AddToShiftOverCapacityDialog
            open={showOverCapacityConfirm}
            onOpenChange={setShowOverCapacityConfirm}
            volunteerName={volunteer.name}
            onConfirm={() => {
              setShowOverCapacityConfirm(false);
              void addToShift(true);
            }}
            isPending={addToShiftMutation.isPending}
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
