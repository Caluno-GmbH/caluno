const PENDING_EVENT_WEEK = 'pending_event_week';

export type PendingEventWeek = { eventId: string; week: string };

export const setPendingEventWeek = (value: PendingEventWeek): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_EVENT_WEEK, JSON.stringify(value));
};

export const takePendingEventWeek = (eventId: string): string | null => {
  if (typeof window === 'undefined') return null;
  const data = sessionStorage.getItem(PENDING_EVENT_WEEK);

  if (!data) return null;

  try {
    const pending: PendingEventWeek = JSON.parse(data);
    if (pending.eventId !== eventId) return null;

    sessionStorage.removeItem(PENDING_EVENT_WEEK);
    return pending.week;
  } catch (error) {
    console.error('Failed to parse pending event week data', error);
    sessionStorage.removeItem(PENDING_EVENT_WEEK);
    return null;
  }
};
