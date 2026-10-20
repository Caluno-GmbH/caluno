import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  setPendingEventWeek,
  takePendingEventWeek,
} from '../pending-event-week';

const KEY = 'pending_event_week';

describe('pending event week', () => {
  afterAll(() => {
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
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
    Object.assign(globalThis, { window: {}, sessionStorage });
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
    Object.assign(globalThis, {
      sessionStorage: {
        getItem: blocked,
        setItem: blocked,
        removeItem: blocked,
      },
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
