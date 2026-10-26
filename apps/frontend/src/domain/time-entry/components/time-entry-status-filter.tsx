'use client';

import { TimeEntryStatus } from '@repo/data';
import { Checkbox, Popover, PopoverContent, PopoverTrigger } from '@repo/ui';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryStates } from 'nuqs';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { TIME_ENTRY_STATUS_DISPLAY } from '../time-entry-status';

const STATUSES = Object.values(TimeEntryStatus) as TimeEntryStatus[];

export const TimeEntryStatusFilter = () => {
  const t = useTranslations('TimeEntry');
  const [{ status }, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: false,
  });

  const toggle = (value: TimeEntryStatus, checked: boolean) => {
    const next = checked
      ? [...status, value]
      : status.filter((current) => current !== value);
    // A different result set can have fewer pages, so go back to the first.
    void setParams({ status: next, page: 1 });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {t('filter.status')}
          {status.length > 0 && (
            <span className="tabular-nums text-foreground">
              ({status.length})
            </span>
          )}
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-2 p-3">
        {STATUSES.map((value) => {
          const id = `time-entry-status-${value}`;
          return (
            <div key={value} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={status.includes(value)}
                onCheckedChange={(checked) => toggle(value, checked === true)}
              />
              <label htmlFor={id} className="text-sm">
                {t(`status.${TIME_ENTRY_STATUS_DISPLAY[value].labelKey}`)}
              </label>
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
