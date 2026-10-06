import { headers } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { API_URL } from './constants';

export interface TermsStatusResponse {
  mustAccept: boolean;
  currentVersion: string | null;
  currentClass: string | null;
  acceptedVersion: string | null;
  acceptedAt: string | null;
}

export async function fetchTermsStatus(): Promise<TermsStatusResponse | null> {
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
}

function isSupportedLocale(value: string): boolean {
  return (routing.locales as readonly string[]).includes(value);
}

export function isTermsGateExempt(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) {
    return false;
  }

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first === undefined) {
    return false;
  }

  const startIndex = isSupportedLocale(first) ? 1 : 0;
  const top = segments[startIndex];
  return top === 'accept-terms' || top === 'unsubscribe';
}

export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first !== undefined && isSupportedLocale(first)) {
    segments.shift();
  }
  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

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
