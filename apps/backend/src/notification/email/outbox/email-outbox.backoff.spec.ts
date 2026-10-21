import { describe, expect, it } from 'bun:test';
import {
  computeNextAttemptDelayMs,
  EMAIL_RETRY_BACKOFF_MS,
} from './email-outbox.backoff';

describe('computeNextAttemptDelayMs', () => {
  it('uses the configured backoff ladder', () => {
    expect(computeNextAttemptDelayMs(1, () => 0.5)).toBe(60_000);
    expect(computeNextAttemptDelayMs(2, () => 0.5)).toBe(5 * 60_000);
    expect(computeNextAttemptDelayMs(3, () => 0.5)).toBe(15 * 60_000);
    expect(computeNextAttemptDelayMs(4, () => 0.5)).toBe(60 * 60_000);
  });

  it('clamps above and below the ladder', () => {
    expect(computeNextAttemptDelayMs(0, () => 0.5)).toBe(
      EMAIL_RETRY_BACKOFF_MS[0],
    );
    expect(computeNextAttemptDelayMs(-3, () => 0.5)).toBe(
      EMAIL_RETRY_BACKOFF_MS[0],
    );
    expect(computeNextAttemptDelayMs(99, () => 0.5)).toBe(
      EMAIL_RETRY_BACKOFF_MS[EMAIL_RETRY_BACKOFF_MS.length - 1],
    );
  });

  it('applies ±20% jitter', () => {
    expect(computeNextAttemptDelayMs(1, () => 0)).toBe(48_000);
    expect(computeNextAttemptDelayMs(1, () => 1)).toBe(72_000);
  });
});
