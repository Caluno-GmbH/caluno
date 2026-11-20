import { useTranslations } from 'next-intl';

const ALL_WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export function recurrenceLabelKey(
  rrule: string | null | undefined,
): 'daily' | 'weekly' | null {
  if (!rrule?.includes('FREQ=WEEKLY')) return null;

  const byDay = rrule.match(/BYDAY=([A-Z,]+)/)?.[1]?.split(',') ?? [];
  if (ALL_WEEKDAYS.every((day) => byDay.includes(day))) return 'daily';

  return 'weekly';
}

export function useRecurrenceLabel() {
  const t = useTranslations('VolunteerHome');

  return (rrule: string | null | undefined): string | null => {
    const key = recurrenceLabelKey(rrule);
    return key ? t(key) : null;
  };
}
