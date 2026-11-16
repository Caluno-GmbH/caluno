'use client';

import { createContext, type ReactNode, useContext, useEffect } from 'react';

/**
 * A hold is a pair of functions: calling it suspends background invalidation
 * until the returned release is invoked. The poller produces these; this
 * context hands them down to forms that must not refresh mid-edit.
 */
export type BackgroundRefreshHold = () => () => void;

/**
 * The context value: the poller's `hold` closure plus a `generation` counter
 * that the producer bumps every time it (re)creates or tears down the poller.
 *
 * The hold closure resolves the *live* poller at call time, so it silently
 * degrades to a no-op before the first poller exists and after one is torn
 * down. `generation` is what lets a consumer notice those transitions: it is
 * part of the hold effect's deps, so a hold taken on a commit that runs before
 * the provider's first effect, or across a poller recreation, is released and
 * re-acquired against the current instance instead of being lost.
 */
export interface BackgroundRefreshHoldState {
  hold: BackgroundRefreshHold;
  generation: number;
}

const BackgroundRefreshHoldContext =
  createContext<BackgroundRefreshHoldState | null>(null);

export interface BackgroundRefreshHoldProviderProps {
  /** The live hold state, or null when the change feed is disabled. */
  value: BackgroundRefreshHoldState | null;
  children: ReactNode;
}

export function BackgroundRefreshHoldProvider({
  value,
  children,
}: BackgroundRefreshHoldProviderProps) {
  return (
    <BackgroundRefreshHoldContext.Provider value={value}>
      {children}
    </BackgroundRefreshHoldContext.Provider>
  );
}

/**
 * Holds background refreshes while `active` is true and releases on `false` or
 * unmount. Outside a `DataProvider` with the change feed enabled this is a safe
 * no-op, so public pages and accept-terms can call it unconditionally.
 *
 * `generation` in the deps re-binds the hold whenever the provider recreates
 * the poller, so an active hold followed by a poller rebuild keeps holding the
 * new instance. React flushes passive effects child-first, so on the provider's
 * first commit this effect runs before the poller exists; the provider then
 * renders with `generation === 1`, which re-runs this effect and acquires the
 * hold for real.
 */
export function useHoldBackgroundRefresh(active: boolean): void {
  const state = useContext(BackgroundRefreshHoldContext);
  const hold = state?.hold ?? null;
  const generation = state?.generation ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `generation` is an intentional re-run trigger, not a value the effect reads. The hold closure resolves the live poller at call time, so the effect must re-run (release + re-acquire) whenever the poller is (re)created even though the closure identity is stable.
  useEffect(() => {
    if (!active || !hold) {
      return;
    }
    const release = hold();
    return release;
  }, [active, hold, generation]);
}
