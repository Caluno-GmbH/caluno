import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { hasEeEdition } from '@/edition/has-ee-edition';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import { mergeEeMessages } from './merge-ee-messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` comes from the `[locale]` segment (added in a later subtask).
  // Until then it is undefined and we fall back to the default locale.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  if (!hasEeEdition()) {
    return { locale, timeZone: DEFAULT_TIMEZONE, messages };
  }

  // EE-only copy lives in its own `messages/ee/` tree so the OSS mirror
  // (which strips any directory literally named `ee`) never ships it.
  // `webpackIgnore` defers resolution to runtime, since that file does not
  // exist in an OSS checkout.
  const eeMessages = (
    await import(/* webpackIgnore: true */ `../../messages/ee/${locale}.json`)
  ).default;

  return {
    locale,
    timeZone: DEFAULT_TIMEZONE,
    messages: mergeEeMessages(messages, eeMessages),
  };
});
