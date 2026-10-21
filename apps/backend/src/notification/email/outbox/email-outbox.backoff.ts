// Minutes to hours, not seconds: a provider timeout is ambiguous, and fast
// retries are how a burst turns into a retry storm.
export const EMAIL_RETRY_BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  4 * 60 * 60_000,
  12 * 60 * 60_000,
  24 * 60 * 60_000,
] as const;

export function computeNextAttemptDelayMs(
  attemptsMade: number,
  random: () => number = Math.random,
): number {
  const index = Math.min(
    Math.max(attemptsMade - 1, 0),
    EMAIL_RETRY_BACKOFF_MS.length - 1,
  );
  const base = EMAIL_RETRY_BACKOFF_MS[index] as number;
  return Math.round(base * (0.8 + random() * 0.4));
}
