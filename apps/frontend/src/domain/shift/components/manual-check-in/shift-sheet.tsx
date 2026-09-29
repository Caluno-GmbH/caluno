'use client';

import { useCheckInShifts } from '@repo/data/react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Separator,
} from '@repo/ui';
import { Check, CircleSlash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormatting } from '@/lib/formatting/use-formatting';
import {
  type CheckInInstance,
  instancesOnDate,
} from '../../check-in-selection';
import { CheckInSheet } from './check-in-sheet';

type ShiftSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgUnitId: string;
  instances: CheckInInstance[];
  selectedDate: Date | null;
  selectedShiftInstanceId: string | null;
  withoutShift: boolean;
  onSelectInstance: (instance: CheckInInstance) => void;
  onSelectShift: (shiftId: string) => void;
  onSelectWithoutShift: () => void;
};

export function ShiftSheet({
  open,
  onOpenChange,
  orgUnitId,
  instances,
  selectedDate,
  selectedShiftInstanceId,
  withoutShift,
  onSelectInstance,
  onSelectShift,
  onSelectWithoutShift,
}: ShiftSheetProps) {
  const t = useTranslations('CheckIn');
  const { formatTimeRange } = useFormatting();
  const [search, setSearch] = useState('');

  const dayInstances = selectedDate
    ? instancesOnDate(instances, selectedDate)
    : [];

  const normalizedSearch = search.trim().toLowerCase();
  const visibleDayInstances = dayInstances.filter((instance) =>
    instance.title.toLowerCase().includes(normalizedSearch),
  );

  const { data: matchingShifts } = useCheckInShifts(orgUnitId, search);

  // Shifts matching the typed name that do not run on the selected date.
  const dayShiftIds = new Set(dayInstances.map((i) => i.masterId));
  const otherDayShifts = (matchingShifts ?? []).filter(
    (shift) => !dayShiftIds.has(shift.id),
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
    }
    onOpenChange(next);
  };

  return (
    <CheckInSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t('shiftSheetTitle')}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => handleOpenChange(false)}
        >
          {t('saveSelection')}
        </Button>
      }
    >
      <Command
        forceShowInput
        shouldFilter={false}
        className="flex h-auto min-h-0 flex-col"
      >
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={t('shiftSearchPlaceholder')}
        />
        <CommandList className="max-h-none flex-1">
          {visibleDayInstances.length === 0 && otherDayShifts.length === 0 && (
            <CommandEmpty>{t('noShiftsFound')}</CommandEmpty>
          )}

          {visibleDayInstances.map((instance) => {
            const isSelected = instance.id === selectedShiftInstanceId;

            return (
              <CommandItem
                key={instance.id}
                value={instance.id}
                onSelect={() => {
                  onSelectInstance(instance);
                  handleOpenChange(false);
                }}
                className={cn(
                  'cursor-pointer justify-between',
                  isSelected && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {instance.title}
                  </span>
                  <span className="block text-muted-foreground">
                    {formatTimeRange(
                      instance.actualStartsAt,
                      instance.actualEndsAt,
                    )}
                  </span>
                </span>
                {isSelected && <Check className="size-4 shrink-0" />}
              </CommandItem>
            );
          })}

          {otherDayShifts.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('foundOnOtherDays')}
              </p>
              {otherDayShifts.map((shift) => (
                <CommandItem
                  key={shift.id}
                  value={shift.id}
                  onSelect={() => {
                    onSelectShift(shift.id);
                    handleOpenChange(false);
                  }}
                  className="cursor-pointer"
                >
                  {shift.title}
                </CommandItem>
              ))}
            </>
          )}
        </CommandList>
      </Command>

      <div>
        <div className="flex items-center gap-3 pb-2">
          <Separator className="flex-1" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('orDivider')}
          </p>
          <Separator className="flex-1" />
        </div>
        <button
          type="button"
          onClick={() => {
            onSelectWithoutShift();
            handleOpenChange(false);
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
            withoutShift
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground',
          )}
        >
          <CircleSlash className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {t('checkInWithoutShift')}
          </span>
          {withoutShift && <Check className="size-4 shrink-0" />}
        </button>
      </div>
    </CheckInSheet>
  );
}
