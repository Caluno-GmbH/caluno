import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { lookupSession, type SessionLookup } from './session-fetch';
import { buildSignInHref } from './sign-in-redirect';

async function lookupRequestSession(): Promise<SessionLookup> {
  const headersList = await headers();
  const cookieHeader = headersList.get('cookie');

  if (!cookieHeader) {
    return { state: 'signed-out' };
  }

  return lookupSession(cookieHeader);
}

/** Public and auth pages: a session the backend could not verify counts as signed out. */
export async function getSession() {
  const lookup = await lookupRequestSession();
  return lookup.state === 'signed-in' ? lookup.session : null;
}

export async function requireAuth() {
  const lookup = await lookupRequestSession();

  if (lookup.state === 'unknown') {
    throw new Error(`Could not verify the session: ${lookup.reason}`);
  }

  const session = lookup.state === 'signed-in' ? lookup.session : null;
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
