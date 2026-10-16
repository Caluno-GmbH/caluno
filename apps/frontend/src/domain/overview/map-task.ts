import { parseISO } from 'date-fns';
import {
  billingMonthOf,
  contractPeriodKind,
} from '@/domain/accounting/lib/billing-period';
import { centsToEuros, formatHourlyRate } from '@/domain/accounting/lib/money';
import { intlLocaleTag } from '@/i18n/locales';
import { formats } from '@/lib/formatting/formats';
import type { OverviewDetail, OverviewTask } from './tasks';
import type { OverviewSourceTask } from './visible-tasks';

/**
 * Card fields read from `task.data`. The query owns which rows exist;
 * this only formats the fields a card shows.
 *
 * Shift below minimum: title, startsAt, endsAt, approvedCount, minimum
 * Shift / event join requests: title, startsAt, endsAt, openRequestCount
 * Membership request: firstName, lastName, email, requestedAt
 * Contract to create / countersign / declined document: volunteerName,
 *   reimbursementTypeName, periodStart, periodEnd, declineReason
 * Timesheet to create / sign: volunteerName, reimbursementTypeName, periodStart
 *   (or month as YYYY-MM), hours, amountCents
 * Timesheet bundle: volunteerName, reimbursementTypeName, readyCount, amountCents
 */
export function mapOverviewTask(
  task: OverviewSourceTask,
  locale: string,
  labels?: { reimbursementType?: (key: string) => string },
): OverviewTask {
  const type = task.type as OverviewTask['type'];
  return {
    id: task.id,
    type,
    href: task.link,
    details: detailsFor(task, locale, labels?.reimbursementType),
    sortAt: sortAtFor(task),
    reimbursementTypeKey: readString(task.data, 'reimbursementTypeKey'),
    documentKind: documentKind(type, task.data),
  };
}

function sortAtFor(task: OverviewSourceTask): string | undefined {
  const data = task.data;
  switch (task.type) {
    case 'SHIFT_BELOW_MINIMUM':
    case 'SHIFT_APPROVAL':
    case 'EVENT_APPROVAL':
      return readString(data, 'startsAt');
    case 'MEMBERSHIP_REQUEST':
      return readString(data, 'requestedAt');
    case 'CONTRACT_SIGN':
    case 'TIMESHEET_SIGN':
      return readString(data, 'signedAt') ?? readString(data, 'periodStart');
    case 'CONTRACT_CREATE':
    case 'INVOICE_CREATE':
      return readString(data, 'periodStart');
    case 'DOCUMENT_DECLINED':
      return readString(data, 'declinedAt') ?? readString(data, 'periodStart');
    default:
      return undefined;
  }
}

function documentKind(
  type: OverviewTask['type'],
  data: Record<string, unknown>,
): OverviewTask['documentKind'] {
  if (type === 'CONTRACT_SIGN' || type === 'CONTRACT_CREATE') return 'contract';
  if (
    type === 'TIMESHEET_SIGN' ||
    type === 'TIMESHEET_BUNDLES' ||
    type === 'INVOICE_CREATE'
  )
    return 'invoice';
  const kind = readString(data, 'kind');
  if (kind === 'CONTRACT') return 'contract';
  if (kind === 'INVOICE') return 'invoice';
  return undefined;
}

function detailsFor(
  task: OverviewSourceTask,
  locale: string,
  reimbursementType?: (key: string) => string,
): OverviewDetail[] {
  const data = task.data;
  switch (task.type) {
    case 'SHIFT_BELOW_MINIMUM':
      return present([
        field('title', readString(data, 'title')),
        ...schedule(data),
        field('approvedCount', readCount(data, 'approvedCount')),
        field('minimum', readCount(data, 'minimum')),
        field('maximum', readCount(data, 'maximum')),
      ]);
    case 'SHIFT_APPROVAL':
    case 'EVENT_APPROVAL':
      return present([
        field('title', readString(data, 'title')),
        ...schedule(data),
        field('openRequestCount', readCount(data, 'openRequestCount')),
      ]);
    case 'MEMBERSHIP_REQUEST':
      return present([
        field('firstName', readString(data, 'firstName')),
        field('lastName', readString(data, 'lastName')),
        field('email', readString(data, 'email')),
        field(
          'requestedAt',
          formatWhen(readString(data, 'requestedAt'), locale),
        ),
      ]);
    case 'CONTRACT_SIGN':
    case 'CONTRACT_CREATE':
      return present([
        field('volunteerName', readString(data, 'volunteerName')),
        field('reimbursementType', typeName(data, reimbursementType)),
        field('period', boardPeriod(data, locale)),
        field('signedAt', readString(data, 'signedAt')),
      ]);
    case 'TIMESHEET_SIGN':
    case 'INVOICE_CREATE':
      return present([
        field('volunteerName', readString(data, 'volunteerName')),
        field('reimbursementType', typeName(data, reimbursementType)),
        field('month', timesheetMonth(data, locale)),
        field('signedAt', readString(data, 'signedAt')),
        field('hours', formatHours(readNumber(data, 'hours'), locale)),
        field('amount', formatAmount(readNumber(data, 'amountCents'))),
      ]);
    case 'TIMESHEET_BUNDLES':
      return present([
        field('volunteerName', readString(data, 'volunteerName')),
        field('reimbursementType', typeName(data, reimbursementType)),
        field('readyCount', readCount(data, 'readyCount')),
        field('amount', formatAmount(readNumber(data, 'amountCents'))),
      ]);
    case 'DOCUMENT_DECLINED':
      return present([
        field('volunteerName', readString(data, 'volunteerName')),
        field('reimbursementType', typeName(data, reimbursementType)),
        field('period', boardPeriod(data, locale)),
        field('declineReason', readString(data, 'declineReason')),
        field('declinedAt', readString(data, 'declinedAt')),
      ]);
    default:
      return [];
  }
}

function typeName(
  data: Record<string, unknown>,
  reimbursementType?: (key: string) => string,
): string | undefined {
  const key = readString(data, 'reimbursementTypeKey');
  if (key && reimbursementType) {
    const label = reimbursementType(key);
    if (label) return label;
  }
  return readString(data, 'reimbursementTypeName');
}

function field(
  key: string,
  value: string | undefined,
): OverviewDetail | undefined {
  if (!value) return undefined;
  return { key, value };
}

function present(details: Array<OverviewDetail | undefined>): OverviewDetail[] {
  return details.filter(
    (detail): detail is OverviewDetail => detail !== undefined,
  );
}

function schedule(
  data: Record<string, unknown>,
): Array<OverviewDetail | undefined> {
  const startsAt = readString(data, 'startsAt');
  if (!startsAt) return [];
  return [
    field('startsAt', startsAt),
    field('endsAt', readString(data, 'endsAt')),
  ];
}

/** Year, month, or day range — the same reading as an agreement period. */
function boardPeriod(
  data: Record<string, unknown>,
  locale: string,
): string | undefined {
  const periodStart = readString(data, 'periodStart');
  const periodEnd = readString(data, 'periodEnd');
  if (!periodStart) return undefined;
  if (!periodEnd) return monthLabel(periodStart, locale);

  const kind = contractPeriodKind(periodStart, periodEnd);
  if (kind === 'year') return String(billingMonthOf(periodStart).year);
  if (kind === 'month') return monthLabel(periodStart, locale);

  const formatting = formats(locale);
  const endInclusive = new Date(new Date(periodEnd).getTime() - 1);
  return `${formatting.formatDate(parseISO(periodStart))} – ${formatting.formatDate(endInclusive)}`;
}

function timesheetMonth(
  data: Record<string, unknown>,
  locale: string,
): string | undefined {
  const periodStart = readString(data, 'periodStart');
  if (periodStart) return monthLabel(periodStart, locale);
  const month = readString(data, 'month');
  if (!month) return undefined;
  if (/^\d{4}-\d{2}$/.test(month)) {
    return monthLabel(`${month}-15T12:00:00.000Z`, locale);
  }
  return monthLabel(month, locale);
}

function monthLabel(value: string, locale: string): string {
  return formats(locale).formatDate(parseISO(value), {
    month: 'long',
    year: 'numeric',
  });
}

function formatWhen(
  value: string | undefined,
  locale: string,
): string | undefined {
  if (!value) return undefined;
  return formats(locale).formatDate(parseISO(value));
}

function formatHours(
  hours: number | undefined,
  locale: string,
): string | undefined {
  if (hours === undefined) return undefined;
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    maximumFractionDigits: 2,
  }).format(hours);
}

function formatAmount(cents: number | undefined): string | undefined {
  if (cents === undefined) return undefined;
  return formatHourlyRate(centsToEuros(cents));
}

function readString(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readNumber(
  data: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = data[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readCount(
  data: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = readNumber(data, key);
  return value === undefined ? undefined : String(value);
}
