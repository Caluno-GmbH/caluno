import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  getCheckInTabPreference,
  setCheckInTabPreference,
} from '../check-in-tab-preference';

const KEY = 'check_in_tab';

// Other test files in the same `bun test` run may leave these globals
// non-writable, so stub via defineProperty and restore the original descriptors.
const GLOBALS = ['window', 'sessionStorage'] as const;
const originalDescriptors = GLOBALS.map(
  (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);

const stubGlobal = (name: (typeof GLOBALS)[number], value: unknown) => {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
};

describe('check-in tab preference', () => {
  afterAll(() => {
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
  });

  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    const sessionStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    stubGlobal('window', {});
    stubGlobal('sessionStorage', sessionStorage);
  });

  it('returns null when nothing was stored yet', () => {
    expect(getCheckInTabPreference()).toBeNull();
  });

  it('round-trips a stored tab', () => {
    setCheckInTabPreference('scanner');
    expect(getCheckInTabPreference()).toBe('scanner');
    expect(store.get(KEY)).toBe('scanner');

    setCheckInTabPreference('qr');
    expect(getCheckInTabPreference()).toBe('qr');
  });

  it('returns null for an unrecognised stored value', () => {
    store.set(KEY, 'not-a-tab');
    expect(getCheckInTabPreference()).toBeNull();
  });

  it('does not throw when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    stubGlobal('sessionStorage', {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
    const originalError = console.error;
    console.error = mock(() => {});

    try {
      expect(() => setCheckInTabPreference('scanner')).not.toThrow();
      expect(getCheckInTabPreference()).toBeNull();
    } finally {
      console.error = originalError;
    }
  });

  it('returns null on the server (no window)', () => {
    stubGlobal('window', undefined);
    expect(getCheckInTabPreference()).toBeNull();
    expect(() => setCheckInTabPreference('scanner')).not.toThrow();
  });
});
