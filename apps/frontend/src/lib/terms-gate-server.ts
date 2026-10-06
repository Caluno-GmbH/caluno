import { headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';
import { API_URL } from './constants';
import { isTermsGateExempt, stripLocalePrefix } from './locale-path';

export { isTermsGateExempt };

export interface TermsStatusResponse {
  mustAccept: boolean;
  currentVersion: string | null;
  currentClass: string | null;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

/**
 * Fetch the terms status for the current request. Cached per render pass so
 * the layout, the gate and pages share a single request.
 */
export const fetchTermsStatus = cache(
  async (): Promise<TermsStatusResponse | null> => {
    const headersList = await headers();
    const cookieHeader = headersList.get('cookie');

    if (!cookieHeader) {
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/legal/terms/status`, {
        headers: {
          cookie: cookieHeader,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as TermsStatusResponse;
    } catch {
      return null;
    }
  },
);

export async function requireTermsAccepted(locale: string): Promise<void> {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname');

  if (isTermsGateExempt(pathname)) {
    return;
  }

  const status = await fetchTermsStatus();
  if (!status?.mustAccept) {
    return;
  }

  const next = stripLocalePrefix(pathname ?? '/');
  redirect({
    href: `/accept-terms?next=${encodeURIComponent(next)}`,
    locale,
  });
}
