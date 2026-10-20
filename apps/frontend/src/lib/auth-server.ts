import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { API_URL } from './constants';
import { buildSignInHref } from './sign-in-redirect';

export async function getSession() {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: {
        cookie: cookieHeader,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const session = await response.json();
    return session;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    const headersList = await headers();
    const locale = await getLocale();
    redirect({
      href: buildSignInHref(headersList.get('x-pathname')),
      locale,
    });
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}
