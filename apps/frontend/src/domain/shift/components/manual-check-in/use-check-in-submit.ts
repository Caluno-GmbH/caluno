'use client';

import { type CheckInContextData, useQueryClient } from '@repo/data/react';
import { applyTimeToDate } from '@repo/ui';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { checkInVolunteer } from '@/domain/time-entry/actions';
import { useRouter } from '@/i18n/navigation';
import { useFormatting } from '@/lib/formatting/use-formatting';
import type { CheckInSelection } from '../../check-in-selection';
import { setCheckInSuccessPayload } from '../../check-in-success-dialog';

/**
 * The check-in submission: the start time the admin enters (defaulting to
 * now), its validation against the chosen shift, and the check-in itself,
 * which lands on the check-in home with a success payload.
 */
export function useCheckInSubmit({
  selection,
  volunteer,
}: {
  selection: CheckInSelection;
  volunteer: CheckInContextData['volunteer'];
}) {
  const t = useTranslations('CheckIn');
  const tValidation = useTranslations('TimeEntry.validation');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { formatDate, formatTimeRange, formatTimeRelativeToStart } =
    useFormatting();

  const [startTime, setStartTime] = useState(() => format(new Date(), 'HH:mm'));
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [isSubmitPending, startSubmitTransition] = useTransition();

  const changeStartTime = (value: string) => {
    setStartTime(value);
    setStartTimeError(null);
  };

  const submit = () => {
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

  return {
    startTime,
    changeStartTime,
    startTimeError,
    submit,
    isSubmitPending,
  };
}
