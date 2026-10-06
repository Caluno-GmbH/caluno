import { headers } from 'next/headers';
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
