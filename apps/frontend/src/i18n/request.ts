import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { hasEeEdition } from '@/edition/has-ee-edition';
import { DEFAULT_TIMEZONE } from '@/lib/formatting/formats';
import { mergeEeMessages } from './merge-ee-messages';
import { routing } from './routing';

let warnedMissingEeMessages = false;

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

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
  // (which strips any directory literally named `ee`) never ships it. A
  // bundler-resolved import/require of this path would force Turbopack to
  // statically resolve it at build time, breaking the OSS build where the
  // directory doesn't exist — so this is a plain runtime `fs` read instead
  // (bundlers never touch string arguments to `fs` calls). JSON catalogs
  // cannot use `turbopackOptional` the way `src/ee` UI slots do.
  // `process.cwd()` is the app root both under `next dev` and in the
  // standalone production server (which `chdir`s there on boot), so this
  // resolves correctly in both. See `outputFileTracingIncludes` in
  // `next.config.ts`, which ships this directory in the standalone build.
  const eeMessagesPath = path.join(
    process.cwd(),
    'messages',
    'ee',
    `${locale}.json`,
  );
  try {
    const eeMessages = JSON.parse(await readFile(eeMessagesPath, 'utf8'));
    return {
      locale,
      timeZone: DEFAULT_TIMEZONE,
      messages: mergeEeMessages(messages, eeMessages),
    };
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
    if (!warnedMissingEeMessages) {
      warnedMissingEeMessages = true;
      console.warn(
        `[i18n] EE edition detected but missing ${eeMessagesPath}; using base messages`,
      );
    }
    return { locale, timeZone: DEFAULT_TIMEZONE, messages };
  }
});
