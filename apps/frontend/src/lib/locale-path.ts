import type { Locale } from '@repo/data';
import { routing } from '@/i18n/routing';

/**
 * Edge-safe locale helpers shared by the middleware and the server-side terms
 * gate. Kept free of Node/server-only imports so the middleware bundle stays
 * lean (`@/i18n/routing` only depends on `next-intl/routing`).
 */
export function isSupportedLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Removes any leading supported-locale prefixes from a pathname. Strips all
 * stacked prefixes so a malformed `/en/en/...` normalises to `/...`.
 */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  let startIndex = 0;

  while (
    startIndex < segments.length &&
    isSupportedLocale(segments[startIndex] as string)
  ) {
    startIndex++;
  }

  const remaining = segments.slice(startIndex).join('/');
  return remaining ? `/${remaining}` : '/';
}

/**
 * Paths a pending user must still reach: the terms themselves and email
 * opt-out. Tolerant of a locale prefix. Pure so it can be unit-tested without
 * the server-only imports of the gate module.
 */
export function isTermsGateExempt(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first === undefined) {
    return false;
  }

  const startIndex = isSupportedLocale(first) ? 1 : 0;
  const top = segments[startIndex];
  return top === 'accept-terms' || top === 'unsubscribe';
}
