import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { USER_LOCALE_COOKIE } from '@/lib/locale-constants';
import { localePreferenceRedirect } from './proxy';

function makeRequest(
  pathname: string,
  cookieLocale?: string,
  {
    loggedIn = true,
    acceptLanguage,
  }: { loggedIn?: boolean; acceptLanguage?: string } = {},
): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  const cookies = [
    loggedIn ? 'better-auth.session_token=abc.def' : undefined,
    cookieLocale ? `${USER_LOCALE_COOKIE}=${cookieLocale}` : undefined,
  ].filter(Boolean);
  const headers: Record<string, string> = {};
  if (cookies.length) {
    headers.cookie = cookies.join('; ');
  }
  if (acceptLanguage) {
    headers['accept-language'] = acceptLanguage;
  }
  return new NextRequest(url, {
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

describe('localePreferenceRedirect', () => {
  it('returns null when no locale cookie is set', () => {
    expect(localePreferenceRedirect(makeRequest('/en/dashboard'))).toBeNull();
  });

  it('returns null for a logged-out user even with a mismatching cookie', () => {
    // No session cookie → preference is not applied; next-intl handles the URL.
    expect(
      localePreferenceRedirect(
        makeRequest('/en/dashboard', 'de', { loggedIn: false }),
      ),
    ).toBeNull();
  });

  it('redirects a logged-in user whose cookie differs from the URL', () => {
    const response = localePreferenceRedirect(
      makeRequest('/en/dashboard', 'de', { loggedIn: true }),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/de/dashboard',
    );
  });

  it('keeps the profile locale for authenticated users even when Accept-Language differs', () => {
    // users.locale mirrored in caluno.locale wins; browser language is ignored.
    const response = localePreferenceRedirect(
      makeRequest('/en/dashboard', 'de', {
        loggedIn: true,
        acceptLanguage: 'en-US,en;q=0.9',
      }),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/de/dashboard',
    );
  });

  it('does not apply preference for logged-out visitors (Accept-Language left to next-intl)', () => {
    expect(
      localePreferenceRedirect(
        makeRequest('/', undefined, {
          loggedIn: false,
          acceptLanguage: 'en-US,en;q=0.9',
        }),
      ),
    ).toBeNull();
  });

  it('returns null when the cookie locale matches the URL locale', () => {
    expect(
      localePreferenceRedirect(makeRequest('/de/dashboard', 'de')),
    ).toBeNull();
  });

  it('returns null for unsupported cookie locales', () => {
    expect(
      localePreferenceRedirect(makeRequest('/en/dashboard', 'fr')),
    ).toBeNull();
  });

  it('redirects to the cookie locale stripping the existing prefix', () => {
    const response = localePreferenceRedirect(
      makeRequest('/en/dashboard', 'de'),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/de/dashboard',
    );
  });

  it('redirects the root locale path without duplicating the prefix', () => {
    const response = localePreferenceRedirect(makeRequest('/en', 'de'));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('http://localhost:3000/de');
  });

  it('redirects a bare root path to the cookie locale', () => {
    const response = localePreferenceRedirect(makeRequest('/', 'en'));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('http://localhost:3000/en');
  });

  it('redirects a path without a locale prefix to the cookie locale', () => {
    const response = localePreferenceRedirect(makeRequest('/dashboard', 'en'));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/en/dashboard',
    );
  });

  it('returns null for a bare path when the cookie matches the default locale', () => {
    // `/dashboard` resolves to the default locale (`de`); intl adds the prefix.
    expect(
      localePreferenceRedirect(makeRequest('/dashboard', 'de')),
    ).toBeNull();
  });

  it('normalises a duplicate locale prefix instead of stacking it', () => {
    const response = localePreferenceRedirect(
      makeRequest('/en/en/dashboard', 'de'),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/de/dashboard',
    );
  });

  it('normalises deeply stacked locale prefixes', () => {
    const response = localePreferenceRedirect(
      makeRequest('/en/en/en/dashboard', 'de'),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/de/dashboard',
    );
  });

  it('preserves the query string when redirecting to the cookie locale', () => {
    const response = localePreferenceRedirect(
      makeRequest('/reset-password?token=abc123', 'en'),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/en/reset-password?token=abc123',
    );
  });
});
