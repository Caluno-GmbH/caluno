'use client';

import type { DataError } from '@repo/data';
import { DataProvider, type DataProviderProps } from '@repo/data/react';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { redirect, usePathname } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { handleServerDataClientError } from '@/lib/data-client-errors';
import { resolveDataErrorRedirect } from '@/lib/data-error-redirect';

type AppDataProviderProps = DataProviderProps & {
  /**
   * When false, UNAUTHENTICATED stays a DataError. The public layout passes
   * the server auth flag so an anonymous visitor is not sent to `/login`.
   */
  redirectOnUnauthenticated?: boolean;
};

/**
 * DataProvider for app routes. React Query hooks share this error path with
 * `getDataClient`: UNAUTHENTICATED redirects to login, FORBIDDEN redirects
 * to `/unauthorized`. `DataProvider` rethrows that redirect during render.
 * A bare DataError on that path means the redirect did not throw.
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
      handleServerDataClientError(
        error,
        { redirectOnUnauthenticated },
        (path): never => {
          const href = resolveDataErrorRedirect(path, pathname);
          redirect({ href, locale });
          throw new Error(
            `redirect('${href}') returned instead of throwing — redirect did not fire`,
          );
        },
      );
    },
    [locale, pathname, redirectOnUnauthenticated],
  );

  return (
    <DataProvider {...props} locale={localeProp} onError={onError}>
      {children}
    </DataProvider>
  );
}
