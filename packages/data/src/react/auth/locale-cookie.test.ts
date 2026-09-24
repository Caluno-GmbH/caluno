import { afterEach, beforeAll, describe, expect, it, mock } from 'bun:test';
import { LOCALE_COOKIE } from '../../constants';
import type { clearLocaleCookie as ClearLocaleCookie } from './locale-cookie';

const cookieStore = new Map<string, string>();
const removeCalls: { name: string; options?: unknown }[] = [];

mock.module('js-cookie', () => ({
  default: {
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    remove: (name: string, options?: unknown) => {
      removeCalls.push({ name, options });
      cookieStore.delete(name);
    },
  },
}));

describe('clearLocaleCookie', () => {
  let clearLocaleCookie: typeof ClearLocaleCookie;

  // Dynamic import after mock.module — NodeNext forbids top-level await here.
  beforeAll(async () => {
    ({ clearLocaleCookie } = await import('./locale-cookie.js'));
  });

  afterEach(() => {
    cookieStore.clear();
    removeCalls.length = 0;
  });

  it('removes the caluno.locale preference cookie', () => {
    cookieStore.set(LOCALE_COOKIE, 'de');

    clearLocaleCookie();

    expect(cookieStore.has(LOCALE_COOKIE)).toBe(false);
    expect(removeCalls).toEqual([
      { name: LOCALE_COOKIE, options: { path: '/', sameSite: 'lax' } },
    ]);
  });
});
