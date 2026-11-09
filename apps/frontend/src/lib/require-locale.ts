import type { Locale } from '@repo/data';
import { notFound } from 'next/navigation';
import { isSupportedLocale } from '@/lib/locale-path';

/**
 * Returns the locale when it is supported, otherwise triggers a 404.
 *
 * Call this in a page before fetching any data. Next renders layouts and pages
 * in parallel, so the `[locale]` layout's own `notFound()` does not stop a page
 * from running its GraphQL calls. Without this check, paths the middleware
 * skips (anything with a dot, such as `/favicon.ico`) match `/[locale]` and
 * fire data calls for a request that should simply 404.
 */
export function requireSupportedLocale(locale: string): Locale {
  if (!isSupportedLocale(locale)) {
    notFound();
  }
  return locale;
}
