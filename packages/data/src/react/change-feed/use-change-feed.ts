'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createGraphQLClient } from '../../client/graphql-client';
import type { Locale } from '../../constants';
import { isUnauthenticatedDataError } from '../../errors/data-error';
import { sdkErrorTranslation } from '../../errors/translate';
import { getSdk } from '../../generated/graphql';
import { ChangeFeedRepository } from '../../repositories/change-feed/change-feed.repository';
import type { BackgroundRefreshHoldState } from './background-refresh-hold';
import { ChangeFeedPoller } from './change-feed-poller';
import {
  invalidateAllQueries,
  invalidateChangedAreas,
} from './invalidate-query-clients';

export interface UseChangeFeedOptions {
  /** When false, nothing is built and no request ever fires. */
  enabled: boolean;
  apiUrl: string;
  organizationUnitId?: string;
  locale?: Locale;
  queryClient: QueryClient;
}

/**
 * Runs the change feed for one tab, internal to `DataProvider`. Builds a
 * background GraphQL client that mirrors the main one but translates errors
 * without an `onError` callback, so a background 401 goes quiet instead of
 * redirecting.
 *
 * Returns the poller's `hold` seam paired with a `generation` counter (or null
 * when disabled) so the provider can hand it to `useHoldBackgroundRefresh`. The
 * poller itself is created inside the effect and torn down with it, which keeps
 * the effect StrictMode-safe: the double-invoked cleanup fully stops one
 * instance and the re-run builds a fresh one (the poller's `stop` is terminal,
 * so a memoised instance could not restart).
 *
 * `generation` bumps on every effect run that builds a poller (i.e. on first
 * mount and on any recreation). Consumers include it in their hold effect deps,
 * so a hold requested before the poller exists — React flushes passive effects
 * child-first — or one surviving a poller recreation re-acquires against the
 * live instance instead of silently vanishing.
 */
export function useChangeFeed({
  enabled,
  apiUrl,
  organizationUnitId,
  locale,
  queryClient,
}: UseChangeFeedOptions): BackgroundRefreshHoldState | null {
  const pollerRef = useRef<ChangeFeedPoller | null>(null);
  const [generation, setGeneration] = useState(0);

  // QueryClients of nested page-level providers. Kept outside the effect so
  // registrations survive a poller recreation.
  const nestedClientsRef = useRef(new Set<QueryClient>());
  const registerQueryClientRef = useRef((nested: QueryClient) => {
    nestedClientsRef.current.add(nested);
    return () => {
      nestedClientsRef.current.delete(nested);
    };
  });

  // Stable identity for the hold closure: it always resolves the current
  // poller, which may be recreated across effect runs.
  const holdRef = useRef<() => () => void>(() => {
    const poller = pollerRef.current;
    if (!poller) {
      return () => {};
    }
    return poller.hold();
  });

  useEffect(() => {
    if (!enabled) {
      pollerRef.current = null;
      return;
    }

    const getHeaders = organizationUnitId
      ? (): Record<string, string> => ({
          'x-organization-unit-id': organizationUnitId,
        })
      : undefined;

    const client = createGraphQLClient({
      url: apiUrl,
      credentials: 'include',
      locale,
      headers: getHeaders,
    });
    const sdk = getSdk(client, sdkErrorTranslation);
    const repository = new ChangeFeedRepository(sdk);

    const poller = new ChangeFeedPoller({
      fetchChanges: (cursor) => repository.changesSince(cursor),
      invalidateAreas: (areas) => {
        invalidateChangedAreas(
          [queryClient, ...nestedClientsRef.current],
          areas,
        );
      },
      invalidateAll: () => {
        invalidateAllQueries([queryClient, ...nestedClientsRef.current]);
      },
      isUnauthenticated: isUnauthenticatedDataError,
      setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimer: (handle) =>
        globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
    pollerRef.current = poller;
    // Signal consumers that a live poller now exists (or, on recreation, that
    // the previous one was replaced) so any active hold re-binds to it.
    setGeneration((value) => value + 1);

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        poller.pause();
      } else {
        poller.resume();
      }
    }

    function handleResume() {
      // `online` fires even in a hidden tab (e.g. a reconnect after the OS
      // slept), so resuming unconditionally would restart the 5s polling in
      // the background. Only resume when the tab is actually visible; the
      // `visibilitychange` handler still covers fade-in from hidden.
      if (document.visibilityState === 'visible') {
        poller.resume();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    if (document.visibilityState === 'visible') {
      poller.start();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      poller.stop();
      pollerRef.current = null;
    };
  }, [enabled, apiUrl, organizationUnitId, locale, queryClient]);

  return useMemo(() => {
    if (!enabled) {
      return null;
    }
    return {
      hold: holdRef.current,
      generation,
      registerQueryClient: registerQueryClientRef.current,
    };
  }, [enabled, generation]);
}
