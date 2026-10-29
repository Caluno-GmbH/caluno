'use client';

import {
  useOrganizationVolunteers,
  useShiftsForFilter,
} from '@repo/data/react';
import { TableToolbar } from '@repo/ui';
import { CalendarDays, MapPin, Tag, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { buildTimesheetsActiveFilters } from '@/domain/time-entry/timesheets-active-filters';
import { timesheetsSearchParams } from '@/domain/time-entry/timesheets-search-params';
import { useFormatting } from '@/lib/formatting/use-formatting';

interface TimesheetsToolbarProps {
  orgUnitId: string;
  locationOptions: string[];
  isLoadingLocations?: boolean;
  actions?: ReactNode[];
}

export function TimesheetsToolbar({
  orgUnitId,
  locationOptions,
  isLoadingLocations,
  actions,
}: TimesheetsToolbarProps) {
  const t = useTranslations('TimeEntry');
  const { formatDateRange } = useFormatting();

  const [params, setParams] = useQueryStates(timesheetsSearchParams, {
    shallow: false,
  });

  const { shiftId, volunteerId, dateFrom, dateTo, location, status } = params;

  const { data: volunteers } = useOrganizationVolunteers(orgUnitId);
  const { data: shiftsData } = useShiftsForFilter(orgUnitId);

  const volunteerOptions = useMemo(
    () =>
      (volunteers ?? []).map((v) => ({
        label: v.name ?? v.email,
        value: v.id,
      })),
    [volunteers],
  );

  const shiftOptions = useMemo(
    () =>
      (shiftsData?.items ?? []).map((s) => ({
        label: s.title,
        value: s.id,
      })),
    [shiftsData],
  );

  const selectedShiftLabel =
    shiftOptions.find((s) => s.value === shiftId)?.label ?? null;
  const selectedVolunteerLabel =
    volunteerOptions.find((v) => v.value === volunteerId)?.label ?? null;

  const activeFilters = buildTimesheetsActiveFilters({
    values: { statuses: status, shiftId, volunteerId, dateFrom, dateTo, location },
    labels: {
      status: t('filter.status'),
      shift: t('filter.shift'),
      volunteer: t('filter.volunteer'),
      date: t('filter.date'),
      location: t('filter.location'),
    },
    shiftLabel: selectedShiftLabel,
    volunteerLabel: selectedVolunteerLabel,
    formatDateRange: (from, to) => {
      if (!from && !to) return '';
      return formatDateRange(from ?? new Date(0), to ?? new Date());
    },
    onClear: (field) => {
      const reset: Record<string, unknown> = { page: 1 };
      if (field === 'shift') reset.shiftId = null;
      else if (field === 'volunteer') reset.volunteerId = null;
      else if (field === 'date') { reset.dateFrom = null; reset.dateTo = null; }
      else if (field === 'location') reset.location = null;
      void setParams(reset);
    },
  });

  const onClearAll = () =>
    void setParams({
      shiftId: null,
      volunteerId: null,
      dateFrom: null,
      dateTo: null,
      location: null,
      status: [],
      page: 1,
    });

  return (
    <TableToolbar
      activeFilters={activeFilters}
      onClearAll={onClearAll}
      sheetTitle={t('filter.sheetTitle')}
      actions={actions}
    >
      <TableToolbar.ComboboxById
        value={shiftId ?? undefined}
        onChange={(v) => void setParams({ shiftId: v, page: 1 })}
        options={shiftOptions}
        placeholder={t('filter.shiftPlaceholder')}
        emptyText={t('filter.shiftEmpty')}
        ariaLabel={t('filter.shift')}
        icon={<CalendarDays className="size-4" />}
      />
      <TableToolbar.ComboboxById
        value={volunteerId ?? undefined}
        onChange={(v) => void setParams({ volunteerId: v, page: 1 })}
        options={volunteerOptions}
        placeholder={t('filter.volunteerPlaceholder')}
        emptyText={t('filter.volunteerEmpty')}
        ariaLabel={t('filter.volunteer')}
        icon={<Users className="size-4" />}
      />
      <TableToolbar.DateRange
        value={{ from: dateFrom ?? undefined, to: dateTo ?? undefined }}
        onChange={(v) =>
          void setParams({ dateFrom: v.from ?? null, dateTo: v.to ?? null, page: 1 })
        }
        placeholder={t('filter.datePlaceholder')}
      />
      <TableToolbar.Combobox
        value={location ?? undefined}
        onChange={(v) => void setParams({ location: v ?? null, page: 1 })}
        options={locationOptions}
        placeholder={t('filter.locationPlaceholder')}
        emptyText={t('filter.locationEmpty')}
        ariaLabel={t('filter.location')}
        icon={<MapPin className="size-4" />}
      />
      <TableToolbar.Select
        value={status.length === 1 ? status[0] : undefined}
        onChange={(v) => void setParams({ status: v ? [v as never] : [], page: 1 })}
        options={[
          { label: t('status.open'), value: 'Open' },
          { label: t('status.closed'), value: 'Closed' },
          { label: t('status.autoClosed'), value: 'AutoClosed' },
        ]}
        placeholder={t('filter.statusPlaceholder')}
        ariaLabel={t('filter.status')}
        icon={<Tag className="size-4" />}
      />
    </TableToolbar>
  );
}
