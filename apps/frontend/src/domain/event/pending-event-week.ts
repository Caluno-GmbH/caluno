const PENDING_EVENT_WEEK = 'pending_event_week';

export type PendingEventWeek = { eventId: string; week: string };

// Best-effort: storage can throw (blocked or sandboxed), and a failure here must
// not interrupt the create-shift flow after the shift was already saved.
export const setPendingEventWeek = (value: PendingEventWeek): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_EVENT_WEEK, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to store pending event week', error);
  }
};

export const takePendingEventWeek = (eventId: string): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const data = sessionStorage.getItem(PENDING_EVENT_WEEK);
    if (!data) return null;

    const pending: PendingEventWeek = JSON.parse(data);
    if (pending.eventId !== eventId) return null;

    sessionStorage.removeItem(PENDING_EVENT_WEEK);
    return pending.week;
  } catch (error) {
    console.error('Failed to read pending event week', error);
    try {
      sessionStorage.removeItem(PENDING_EVENT_WEEK);
    } catch {
      // Storage unavailable; nothing to clean up.
    }
    return null;
  }
};
