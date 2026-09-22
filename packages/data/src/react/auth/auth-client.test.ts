import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { LOCALE_COOKIE } from '../../constants';

const cookieStore = new Map<string, string>();
const betterAuthSignOut = mock(() => Promise.resolve({ data: null }));

mock.module('js-cookie', () => ({
  default: {
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    remove: (name: string) => {
      cookieStore.delete(name);
    },
  },
}));

mock.module('better-auth/react', () => ({
  // Mirror Better Auth: a Proxy whose get trap ignores own properties set via
  // Object.assign — the bug that previously swallowed our signOut wrapper.
  createAuthClient: () => {
    const routes = {
      signOut: betterAuthSignOut,
      signIn: {},
      signUp: {},
    };
    return new Proxy(() => {}, {
      get(_target, prop) {
        if (typeof prop !== 'string') return;
        return routes[prop as keyof typeof routes];
      },
    });
  },
}));

mock.module('better-auth/client/plugins', () => ({
  emailOTPClient: () => ({ id: 'email-otp' }),
  inferAdditionalFields: () => ({ id: 'additional-fields' }),
}));

const { createAuthClient } = await import('./auth-client');

describe('createAuthClient signOut', () => {
  beforeEach(() => {
    cookieStore.clear();
    betterAuthSignOut.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  it('clears caluno.locale before delegating to Better Auth signOut', async () => {
    cookieStore.set(LOCALE_COOKIE, 'de');
    cookieStore.set('caluno.last_org_slug', 'acme');

    const auth = createAuthClient('http://localhost:8080');
    // Destructuring matches apps/frontend/src/lib/auth.ts
    const { signOut } = auth;
    await signOut();

    expect(cookieStore.has(LOCALE_COOKIE)).toBe(false);
    expect(cookieStore.has('caluno.last_org_slug')).toBe(false);
    expect(betterAuthSignOut).toHaveBeenCalledTimes(1);
  });

  it('exposes the wrapped signOut through the Better Auth proxy', async () => {
    cookieStore.set(LOCALE_COOKIE, 'en');

    const auth = createAuthClient('http://localhost:8080');
    await auth.signOut();

    expect(cookieStore.has(LOCALE_COOKIE)).toBe(false);
    expect(betterAuthSignOut).toHaveBeenCalledTimes(1);
  });
});
