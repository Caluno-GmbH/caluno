import { getWeekRange } from '@/domain/shift/lib/shift-instances';

// getWeekRange returns TZDate instances, which do not survive RSC
// serialization; callers pass these across the server/client boundary.
function weekStartOf(date: Date): Date {
  return new Date(getWeekRange(date).weekStart.getTime());
}

export function pickInitialWeek(input: {
  instanceStarts: string[];
  now: Date;
  eventStartsAt: Date;
}): Date {
  const { instanceStarts, now, eventStartsAt } = input;
  const current = getWeekRange(now);
  const times = instanceStarts.map((start) => new Date(start).getTime());

  const hasInstanceInCurrentWeek = times.some(
    (time) =>
      time >= current.weekStart.getTime() && time < current.weekEnd.getTime(),
  );
  if (hasInstanceInCurrentWeek) return new Date(current.weekStart.getTime());

  if (times.length > 0) {
    return weekStartOf(new Date(Math.min(...times)));
  }

  return weekStartOf(eventStartsAt);
}

export function findAdjacentShiftWeek(
  instanceStarts: string[],
  weekStart: Date,
): { direction: 'next' | 'previous'; weekStart: Date } | null {
  const { weekEnd } = getWeekRange(weekStart);
  const times = instanceStarts.map((start) => new Date(start).getTime());

  const next = times.filter((time) => time >= weekEnd.getTime());
  if (next.length > 0) {
    return {
      direction: 'next',
      weekStart: weekStartOf(new Date(Math.min(...next))),
    };
  }

  const previous = times.filter((time) => time < weekStart.getTime());
  if (previous.length > 0) {
    return {
      direction: 'previous',
      weekStart: weekStartOf(new Date(Math.max(...previous))),
    };
  }

  return null;
}
