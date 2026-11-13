'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CHECK_IN_POLL_INTERVAL_MS,
  isPollWindowExpired,
} from '../../check-in-polling';

const EXPIRY_CHECK_INTERVAL_MS = 60_000;

/**
 * Drives the check-in page's polling: every query refetches on the returned
 * interval while `active`, until nothing observable (`changeKey`) has changed
 * for the whole poll window. `restart()` reopens the window on demand.
 *
 * Background tabs pause on their own — TanStack's `refetchIntervalInBackground`
 * defaults to false — so polling only runs while the document is visible.
 */
export function useCheckInPollWindow(
  active: boolean,
  changeKey: string,
): { refetchInterval: number | false; expired: boolean; restart: () => void } {
  const [lastChangeAt, setLastChangeAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [trackedKey, setTrackedKey] = useState(changeKey);

  // Adjust state during render rather than in an effect, so the window
  // restarts in the same render that observes the change.
  if (trackedKey !== changeKey) {
    const changedAt = Date.now();
    setTrackedKey(changeKey);
    setLastChangeAt(changedAt);
    setNow(changedAt);
  }

  const expired = active && isPollWindowExpired(lastChangeAt, now);

  useEffect(() => {
    if (!active || expired) return;
    const timer = setInterval(
      () => setNow(Date.now()),
      EXPIRY_CHECK_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [active, expired]);

  const restart = useCallback(() => {
    const restartedAt = Date.now();
    setLastChangeAt(restartedAt);
    setNow(restartedAt);
  }, []);

  return {
    refetchInterval: active && !expired ? CHECK_IN_POLL_INTERVAL_MS : false,
    expired,
    restart,
  };
}
