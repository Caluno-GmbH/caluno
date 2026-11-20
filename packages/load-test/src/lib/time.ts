import { sleep } from 'k6';
import { config } from './config.ts';

/** Pause like a person reading the page before the next action. */
export const think = () => {
  const [min, max] = config.thinkTime;
  sleep(min + Math.random() * (max - min));
};

const DAY_MS = 86_400_000;

export const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const daysFrom = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

export const startOfWeek = (): Date => {
  const today = startOfToday();
  const mondayOffset = (today.getDay() + 6) % 7;
  return daysFrom(today, -mondayOffset);
};
