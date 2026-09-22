import type { Locale } from '@repo/data';

/** The other supported UI locale (en ↔ de). Used by the logged-out auth toggle. */
export function otherLocale(locale: string): Locale {
  return locale === 'de' ? 'en' : 'de';
}
