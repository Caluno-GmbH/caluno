import { formatLifespanShape, parseLifespanShape } from '@repo/lifespan';
import { appDateParts, startOfAppDay } from '../../shift/utils/app-time';
import {
  type BillingPeriod,
  billingMonthBoundsOf,
  billingYearBounds,
  lastDayOfPeriod,
} from './billing-period';
import { contractCoversInstant } from './contract-coverage';

/** The manual template field that holds a contract's Vertragslaufzeit. */
export const CONTRACT_LIFESPAN_FIELD_ID = 'contract-lifespan';

/**
 * The period an auto-queued draft covers for the entry that starts at
 * `anchor`. The template's saved lifespan is concrete ("10/2026"), but only its
 * granularity matters: a month template yields the anchor's month, not October.
 * A range is kept only while it contains the anchor, because a draft that does
 * not cover the entry that queued it would be queued again. Anything else,
 * including an empty or unreadable value, is the anchor's calendar year.
 */
export function draftPeriodForAnchor(
  templateLifespan: string | undefined,
  anchor: Date,
): BillingPeriod {
  const shape = parseLifespanShape(templateLifespan ?? '');

  if (shape?.kind === 'month') return billingMonthBoundsOf(anchor);

  if (shape?.kind === 'range') {
    const range = {
      start: startOfAppDay(
        shape.from.year,
        shape.from.month - 1,
        shape.from.day,
      ),
      end: startOfAppDay(shape.to.year, shape.to.month - 1, shape.to.day + 1),
    };
    if (
      contractCoversInstant(
        { periodStart: range.start, periodEnd: range.end },
        anchor,
      )
    ) {
      return range;
    }
  }

  return billingYearBounds(appDateParts(anchor).year);
}

/**
 * How the period reads as a Vertragslaufzeit: the same strings the template
 * builder's period picker writes, so what a draft prints and what it stores
 * are one value.
 */
export function formatLifespanForPeriod(period: BillingPeriod): string {
  const first = appDateParts(period.start);
  const last = appDateParts(lastDayOfPeriod(period.end));

  const year = billingYearBounds(first.year);
  if (
    period.start.getTime() === year.start.getTime() &&
    period.end.getTime() === year.end.getTime()
  ) {
    return formatLifespanShape({ kind: 'year', year: first.year });
  }

  const monthStart = startOfAppDay(first.year, first.month, 1);
  const monthEnd = startOfAppDay(first.year, first.month + 1, 1);
  if (
    period.start.getTime() === monthStart.getTime() &&
    period.end.getTime() === monthEnd.getTime()
  ) {
    return formatLifespanShape({
      kind: 'month',
      year: first.year,
      month: first.month + 1,
    });
  }

  return formatLifespanShape({
    kind: 'range',
    from: { year: first.year, month: first.month + 1, day: first.day },
    to: { year: last.year, month: last.month + 1, day: last.day },
  });
}
