'use client';

import { TodoFillThreshold, useTodoFillFilter } from '@repo/data/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

const DAYS = [7, 14, 30] as const;

const THRESHOLD_MESSAGE = {
  [TodoFillThreshold.BelowMinimum]: 'BELOW_MINIMUM',
  [TodoFillThreshold.NotFull]: 'NOT_FULL',
} as const;

export function FillAssignmentFilterControl({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Todo.fillFilter');
  const { filter, update } = useTodoFillFilter(orgUId);
  const threshold = THRESHOLD_MESSAGE[filter.threshold];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t('summary', {
            threshold: t(threshold),
            days: t('days', { count: filter.daysAhead }),
          })}
          <ChevronDownIcon className="size-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-3 p-3">
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">{t('staffing')}</legend>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={filter.threshold}
            onValueChange={(value) => {
              if (
                value === TodoFillThreshold.BelowMinimum ||
                value === TodoFillThreshold.NotFull
              ) {
                update({ threshold: value, daysAhead: filter.daysAhead });
              }
            }}
          >
            <ToggleGroupItem value={TodoFillThreshold.BelowMinimum}>
              {t('BELOW_MINIMUM')}
            </ToggleGroupItem>
            <ToggleGroupItem value={TodoFillThreshold.NotFull}>
              {t('NOT_FULL')}
            </ToggleGroupItem>
          </ToggleGroup>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-xs font-medium">{t('daysAhead')}</legend>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={String(filter.daysAhead)}
            onValueChange={(value) => {
              const daysAhead = Number(value);
              if (daysAhead === 7 || daysAhead === 14 || daysAhead === 30) {
                update({ threshold: filter.threshold, daysAhead });
              }
            }}
          >
            {DAYS.map((days) => (
              <ToggleGroupItem key={days} value={String(days)}>
                {t('days', { count: days })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

export function FillAssignmentEmpty({ orgUId }: { orgUId: string }) {
  const t = useTranslations('Todo.fillFilter');
  const { filter } = useTodoFillFilter(orgUId);
  const key =
    filter.threshold === TodoFillThreshold.NotFull
      ? 'emptyNotFull'
      : 'emptyBelowMinimum';

  return (
    <p className="text-sm text-muted-foreground">
      {t(key, { count: filter.daysAhead })}
    </p>
  );
}
