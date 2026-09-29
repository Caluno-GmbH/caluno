import type { Locale } from '../../src/graphql/locale';
import type { EmailTemplateContext } from '../../src/i18n/email-translate';
import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleList,
  formatLocaleTime,
} from '../../src/i18n/format-date-time';
import deEmail from '../../src/i18n/locales/de/email.json';
import enEmail from '../../src/i18n/locales/en/email.json';

const CATALOGS = { en: enEmail, de: deEmail } as const;

/**
 * Builds an {@link EmailTemplateContext} from the real `email` locale catalogs
 * for template unit tests, so assertions run against shipped copy without
 * booting the Nest i18n module. Throws on an unknown key to catch typos.
 */
export function createEmailTemplateFixture(
  locale: Locale = 'en',
): EmailTemplateContext {
  const catalog = CATALOGS[locale];

  return {
    t: (key, params) => {
      const parts = key.split('.');
      let value: unknown = catalog;
      for (const part of parts) {
        value = (value as Record<string, unknown>)[part];
      }
      if (typeof value !== 'string') {
        throw new Error(`Missing email translation for ${key}`);
      }
      return Object.entries(params ?? {}).reduce(
        (result, [paramKey, paramValue]) =>
          result.replace(`{${paramKey}}`, String(paramValue)),
        value,
      );
    },
    formatDateTime: (date) => formatLocaleDateTime(date, locale),
    formatDate: (date) => formatLocaleDate(date, locale),
    formatTime: (date) => formatLocaleTime(date, locale),
    formatList: (items) => formatLocaleList(items, locale),
  };
}
