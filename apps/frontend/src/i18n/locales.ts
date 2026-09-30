import type { Locale } from '@repo/data';
import type { Locale as DateFnsLocale } from 'date-fns';
import { de, enGB } from 'date-fns/locale';

const ENTRIES = {
  en: { label: 'English', intlTag: 'en-GB', dateFns: enGB },
  de: { label: 'Deutsch', intlTag: 'de-DE', dateFns: de },
} satisfies Record<
  Locale,
  { label: string; intlTag: string; dateFns: DateFnsLocale }
>;

// Derived from ENTRIES, not SUPPORTED_LOCALES: importing that as a value pulls
// the @repo/data barrel (and its graphql client) into every consumer's bundle.
// `satisfies Record<Locale, …>` above is what guarantees completeness.
export const LOCALES: {
  key: Locale;
  label: string;
  intlTag: string;
  dateFns: DateFnsLocale;
}[] = (Object.keys(ENTRIES) as Locale[]).map((key) => ({
  key,
  ...ENTRIES[key],
}));

export const localeLabel = (locale: Locale | string): string =>
  LOCALES.find((entry) => entry.key === locale)?.label ?? locale;

export const intlLocaleTag = (locale: string): string =>
  LOCALES.find((entry) => entry.key === locale.toLocaleLowerCase())?.intlTag ??
  'de-DE';

export const localeDateFns = (locale: string): DateFnsLocale =>
  LOCALES.find((entry) => entry.key === locale.toLocaleLowerCase())?.dateFns ??
  de;
