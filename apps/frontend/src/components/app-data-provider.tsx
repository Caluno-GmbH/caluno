'use client';

import type { DataError } from '@repo/data';
import { DataProvider, type DataProviderProps } from '@repo/data/react';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { redirect, usePathname } from '@/i18n/navigation';
import { resolveLocale } from '@/i18n/routing';
import { handleServerDataClientError } from '@/lib/data-client-errors';
import { resolveDataErrorRedirect } from '@/lib/data-error-redirect';

/**
 * DataProvider for app routes. React Query hooks that run during SSR share
 * this error path with `getDataClient`: UNAUTHENTICATED redirects to login,
 * FORBIDDEN redirects to `/unauthorized`. A bare DataError must not become
 * the segment error screen.
 */
export function AppDataProvider({
  children,
  locale: localeProp,
  ...props
}: DataProviderProps) {
  const pathname = usePathname();
  const hookLocale = useLocale();
  const locale = resolveLocale(localeProp ?? hookLocale);

  const onError = useCallback(
    (error: DataError) => {
      handleServerDataClientError(error, {}, (path): never => {
        const href = resolveDataErrorRedirect(path, pathname);
        redirect({ href, locale });
        throw new Error(
          `redirect('${href}') returned instead of throwing — redirect did not fire`,
        );
      });
    },
    [locale, pathname],
  );

  return (
    <DataProvider {...props} locale={localeProp} onError={onError}>
      {children}
    </DataProvider>
  );
}
