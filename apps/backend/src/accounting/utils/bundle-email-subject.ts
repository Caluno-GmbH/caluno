import type { Locale } from '../../graphql/locale';
import { formatLocaleMonthYear } from '../../i18n/format-date-time';

export const BUNDLE_SUBJECT_PLACEHOLDERS = [
  'volunteer',
  'period',
  'type',
] as const;

export type BundleSubjectPlaceholder =
  (typeof BUNDLE_SUBJECT_PLACEHOLDERS)[number];

export const MAX_BUNDLE_SUBJECT_LENGTH = 200;

// Not in the i18n catalogs: nestjs-i18n would treat the placeholders as its
// own interpolation arguments.
export const DEFAULT_BUNDLE_SUBJECT: Record<Locale, string> = {
  de: 'Abrechnung {volunteer} – {period} ({type})',
  en: 'Reimbursement {volunteer} – {period} ({type})',
};

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;

export function unknownSubjectPlaceholders(subject: string): string[] {
  const known = new Set<string>(BUNDLE_SUBJECT_PLACEHOLDERS);
  return [...subject.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1] ?? '')
    .filter((name) => !known.has(name));
}

/**
 * Fills the placeholders and folds line breaks, which would otherwise end
 * the header early when a value carries one.
 */
export function renderBundleSubject(
  subject: string,
  values: Record<BundleSubjectPlaceholder, string>,
): string {
  return subject
    .replace(PLACEHOLDER_PATTERN, (match, name: string) =>
      name in values ? values[name as BundleSubjectPlaceholder] : match,
    )
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * The months a bundle's timesheets cover: "Oktober 2026", or the first and
 * last month joined, "September 2026 – Oktober 2026".
 */
export function formatBundlePeriod(
  periodStarts: readonly Date[],
  locale: Locale,
): string {
  const sorted = [...periodStarts].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return '';
  const firstLabel = formatLocaleMonthYear(first, locale);
  const lastLabel = formatLocaleMonthYear(last, locale);
  return firstLabel === lastLabel ? firstLabel : `${firstLabel} – ${lastLabel}`;
}
