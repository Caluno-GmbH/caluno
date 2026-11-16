import { describe, expect, it } from 'bun:test';
import {
  decodeFeedCursor,
  encodeFeedCursor,
  FEED_RETENTION_MS,
  type FeedCursor,
  isFeedCursorExpired,
} from './feed-cursor';

describe('feed cursor', () => {
  it('round-trips xmin and issue time', () => {
    const cursor: FeedCursor = {
      xmin: '123456',
      issuedAt: new Date(1_700_000_000_000),
    };

    const encoded = encodeFeedCursor(cursor);
    expect(typeof encoded).toBe('string');

    const decoded = decodeFeedCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.xmin).toBe('123456');
    expect(decoded?.issuedAt).toBeInstanceOf(Date);
    expect(decoded?.issuedAt.getTime()).toBe(1_700_000_000_000);
  });

  it('rejects malformed input', () => {
    expect(decodeFeedCursor('')).toBeNull();
    expect(decodeFeedCursor('abc')).toBeNull();

    // Valid base64url payload with a non-numeric xmin.
    const nonNumericXmin = Buffer.from('abc.1700000000000', 'utf8').toString(
      'base64url',
    );
    expect(decodeFeedCursor(nonNumericXmin)).toBeNull();

    // Negative issue time.
    const negativeTime = Buffer.from('123.-1', 'utf8').toString('base64url');
    expect(decodeFeedCursor(negativeTime)).toBeNull();

    // Extra parts.
    const extraParts = Buffer.from('123.1700000000000.extra', 'utf8').toString(
      'base64url',
    );
    expect(decodeFeedCursor(extraParts)).toBeNull();

    // Not a valid base64url string (illegal characters).
    expect(decodeFeedCursor('!!!not-base64!!!')).toBeNull();
  });

  it('is expired one millisecond after 24h and not before', () => {
    const issuedAt = new Date(1_700_000_000_000);

    const exactlyAtLimit = new Date(issuedAt.getTime() + FEED_RETENTION_MS);
    expect(isFeedCursorExpired({ xmin: '1', issuedAt }, exactlyAtLimit)).toBe(
      false,
    );

    const oneMsAfter = new Date(issuedAt.getTime() + FEED_RETENTION_MS + 1);
    expect(isFeedCursorExpired({ xmin: '1', issuedAt }, oneMsAfter)).toBe(true);
  });
});
