'use client';

import { Input, Separator } from '@repo/ui';
import { Building2, CalendarDays, CircleSlash, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormatting } from '@/lib/formatting/use-formatting';
import type { CheckInSelection } from '../../check-in-selection';
import { StepperRow } from './stepper-row';

type ShiftInstanceStepperProps = {
  selection: CheckInSelection;
  orgUnits: Array<{ id: string; name: string }>;
  /** Renders the shift row as the without-assignment choice. */
  withoutShift: boolean;
  onOpenOrgUnit: () => void;
  onOpenDate: () => void;
  onOpenShift: () => void;
  startTime: string;
  onStartTimeChange: (startTime: string) => void;
  startTimeError: string | null;
};

export function ShiftInstanceStepper({
  selection,
  orgUnits,
  withoutShift,
  onOpenOrgUnit,
  onOpenDate,
  onOpenShift,
  startTime,
  onStartTimeChange,
  startTimeError,
}: ShiftInstanceStepperProps) {
  const t = useTranslations('CheckIn');
  const { formatDate, formatTimeRange } = useFormatting();

  const selectedOrgUnit = orgUnits.find((u) => u.id === selection.orgUnitId);
  const selectedInstance = selection.selectedInstance;

  const isToday =
    !!selection.date &&
    selection.date.toDateString() === new Date().toDateString();
  const dateLabel = selection.date
    ? isToday
      ? t('today')
      : formatDate(selection.date)
    : t('selectDatePlaceholder');

  const shiftLabel = withoutShift
    ? t('checkInWithoutShift')
    : selectedInstance
      ? selectedInstance.title
      : t('selectShiftPlaceholder');
  const shiftSublabel =
    !withoutShift && selectedInstance
      ? formatTimeRange(
          selectedInstance.actualStartsAt,
          selectedInstance.actualEndsAt,
        )
      : undefined;

  return (
    <div className="rounded-xl bg-muted px-3 py-1 shadow-sm">
      {orgUnits.length > 1 && (
        <>
          <StepperRow
            label={selectedOrgUnit?.name ?? t('orgUnitRowLabel')}
            icon={<Building2 className="size-4 text-muted-foreground" />}
            onClick={onOpenOrgUnit}
          />
          <Separator />
        </>
      )}

      <StepperRow
        label={dateLabel}
        isEmpty={!selection.date}
        icon={<CalendarDays className="size-4 text-muted-foreground" />}
        onClick={onOpenDate}
      />
      <Separator />

      <StepperRow
        label={shiftLabel}
        sublabel={shiftSublabel}
        isEmpty={!withoutShift && !selectedInstance}
        icon={
          withoutShift ? (
            <CircleSlash className="size-4 text-muted-foreground" />
          ) : undefined
        }
        onClick={onOpenShift}
      />

      <Separator />

      <div className="py-2">
        <div className="flex w-full items-center gap-2">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <label htmlFor="check-in-start-time" className="flex-1 font-semibold">
            {t('startTimeLabel')}
          </label>
          <Input
            id="check-in-start-time"
            type="time"
            className="w-32"
            value={startTime}
            onChange={(event) => onStartTimeChange(event.target.value)}
            aria-invalid={startTimeError ? true : undefined}
          />
        </div>
        {startTimeError && (
          <p className="pt-1 text-sm text-destructive">{startTimeError}</p>
        )}
      </div>
    </div>
  );
}
