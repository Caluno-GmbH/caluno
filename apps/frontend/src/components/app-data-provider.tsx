'use client';

import { type DataError, isUnauthenticatedDataError } from '@repo/data';
import { DataProvider, type DataProviderProps } from '@repo/data/react';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { redirect, usePathname } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { resolveDataErrorRedirect } from '@/lib/data-error-redirect';

type AppDataProviderProps = DataProviderProps & {
  /**
   * When false, UNAUTHENTICATED stays a DataError. The public layout passes
   * the server auth flag so an anonymous visitor is not sent to `/login`.
   */
  redirectOnUnauthenticated?: boolean;
};

/**
 * DataProvider for app routes. UNAUTHENTICATED from a React Query hook
 * redirects to login; `DataProvider` rethrows that redirect during render.
 * Every other DataError (FORBIDDEN included) stays with the caller, so a
 * missing permission is a toast, not a lost page.
 */
export function AppDataProvider({
  children,
  locale: localeProp,
  redirectOnUnauthenticated = true,
  ...props
}: AppDataProviderProps) {
  const pathname = usePathname();
  const hookLocale = useLocale();
  const locale = resolveLocale(localeProp ?? hookLocale);

  const onError = useCallback(
    (error: DataError) => {
      if (redirectOnUnauthenticated && isUnauthenticatedDataError(error)) {
        redirect({
          href: resolveDataErrorRedirect('/login', pathname),
          locale,
        });
      }
    },
    [locale, pathname, redirectOnUnauthenticated],
  );

  return (
    <DataProvider {...props} locale={localeProp} onError={onError}>
      {children}
    </DataProvider>
  );
}
