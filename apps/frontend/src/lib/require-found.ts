import { isNotFoundDataError } from '@repo/data';
import { notFound } from 'next/navigation';
import { logger } from '@/lib/logger';

/**
 * Runs an async loader and maps missing data to Next.js `notFound()`.
 * Treats both thrown NOT_FOUND DataErrors and nullish results as 404.
 * Other errors are rethrown unless `onOtherError` is provided.
 *
 * `notFound()` is invoked outside the loader catch path so Next's control-flow
 * throw is never swallowed by `onOtherError`.
 */
export async function requireFound<T>(
  load: () => Promise<T | null | undefined>,
): Promise<NonNullable<T>>;
export async function requireFound<T, F>(
  load: () => Promise<T | null | undefined>,
  onOtherError: (error: unknown) => F,
): Promise<NonNullable<T> | F>;
export async function requireFound<T, F>(
  load: () => Promise<T | null | undefined>,
  onOtherError?: (error: unknown) => F,
): Promise<NonNullable<T> | F> {
  let value: T | null | undefined;
  try {
    value = await load();
  } catch (error) {
    if (isNotFoundDataError(error)) {
      notFound();
    }
    if (onOtherError) {
      return onOtherError(error);
    }
    throw error;
  }
  if (value == null) notFound();
  return value;
}

/**
 * Like `requireFound`, but soft-fails non-not-found errors to `null`
 * (e.g. `generateMetadata` title fallbacks). Still calls `notFound()` for
 * missing data. Logs other errors so they are not swallowed silently.
 */
export async function requireFoundOrNull<T>(
  load: () => Promise<T | null | undefined>,
): Promise<NonNullable<T> | null> {
  return requireFound(load, (error) => {
    logger.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'requireFoundOrNull: non-not-found error',
    );
    return null;
  });
}
