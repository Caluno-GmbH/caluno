/**
 * Opaque cursor for the change feed.
 *
 * A cursor pins a point in the `change_feed_entries` log by its Postgres
 * transaction id (`xmin`) plus the time it was issued. It is deliberately
 * opaque to clients: the payload is a `${xmin}.${issuedAt epoch ms}` pair
 * encoded as base64url so callers cannot (and should not) interpret it.
 *
 * Everything here is a pure function: no Nest, no database, no `ee` imports.
 */

export interface FeedCursor {
  xmin: string;
  issuedAt: Date;
}

/** How long a cursor stays valid before the prune scheduler may drop it. */
export const FEED_RETENTION_MS = 24 * 60 * 60 * 1000;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const DIGITS_PATTERN = /^[0-9]+$/;

export function encodeFeedCursor(cursor: FeedCursor): string {
  const payload = `${cursor.xmin}.${cursor.issuedAt.getTime()}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeFeedCursor(value: string): FeedCursor | null {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value)) {
    return null;
  }

  let payload: string;
  try {
    payload = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  // Reject inputs that only decode because Buffer tolerates sloppy base64
  // (bad padding, trailing garbage, non-canonical length).
  if (Buffer.from(payload, 'utf8').toString('base64url') !== value) {
    return null;
  }

  const parts = payload.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [xmin, rawIssuedAt] = parts;
  if (!DIGITS_PATTERN.test(xmin)) {
    return null;
  }

  if (!DIGITS_PATTERN.test(rawIssuedAt)) {
    return null;
  }

  const issuedAtMs = Number(rawIssuedAt);
  if (!Number.isSafeInteger(issuedAtMs)) {
    return null;
  }

  const issuedAt = new Date(issuedAtMs);
  if (Number.isNaN(issuedAt.getTime())) {
    return null;
  }

  return { xmin, issuedAt };
}

export function isFeedCursorExpired(cursor: FeedCursor, now: Date): boolean {
  return now.getTime() - cursor.issuedAt.getTime() > FEED_RETENTION_MS;
}
