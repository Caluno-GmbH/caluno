import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { fetchSession } from './session-fetch';
import { buildSignInHref } from './sign-in-redirect';

export async function getSession() {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');

  if (!cookieHeader) {
    return null;
  }

  return fetchSession(cookieHeader);
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
