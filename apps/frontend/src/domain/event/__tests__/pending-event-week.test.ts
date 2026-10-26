import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  setPendingEventWeek,
  takePendingEventWeek,
} from '../pending-event-week';

const KEY = 'pending_event_week';

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

describe('pending event week', () => {
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

  it('only hands the week to the matching event, once', () => {
    setPendingEventWeek({ eventId: 'e1', week: '2026-09-07' });

    expect(takePendingEventWeek('e2')).toBeNull();
    expect(takePendingEventWeek('e1')).toBe('2026-09-07');
    expect(takePendingEventWeek('e1')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    store.set(KEY, '{not json');
    const originalError = console.error;
    const errorMock = mock(() => {});
    console.error = errorMock;

    try {
      expect(takePendingEventWeek('e1')).toBeNull();
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(store.has(KEY)).toBe(false);
    } finally {
      console.error = originalError;
    }
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
      expect(() =>
        setPendingEventWeek({ eventId: 'e1', week: '2026-09-07' }),
      ).not.toThrow();
      expect(takePendingEventWeek('e1')).toBeNull();
    } finally {
      console.error = originalError;
    }
  });
});
