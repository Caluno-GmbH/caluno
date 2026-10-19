import { getWeekRange } from '@/domain/shift/lib/shift-instances';

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
  if (hasInstanceInCurrentWeek) return current.weekStart;

  if (times.length > 0) {
    return getWeekRange(new Date(Math.min(...times))).weekStart;
  }

  return getWeekRange(eventStartsAt).weekStart;
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
      weekStart: getWeekRange(new Date(Math.min(...next))).weekStart,
    };
  }

  const previous = times.filter((time) => time < weekStart.getTime());
  if (previous.length > 0) {
    return {
      direction: 'previous',
      weekStart: getWeekRange(new Date(Math.max(...previous))).weekStart,
    };
  }

  return null;
}
