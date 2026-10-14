import { isNotFoundDataError } from '@repo/data';
import { notFound } from 'next/navigation';

/**
 * Runs an async loader and maps missing data to Next.js `notFound()`.
 * Treats both thrown NOT_FOUND DataErrors and nullish results as 404.
 * Other errors are rethrown unless `onOtherError` is provided (e.g. metadata fallbacks).
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
  try {
    const value = await load();
    if (value == null) notFound();
    return value;
  } catch (error) {
    if (isNotFoundDataError(error)) {
      notFound();
    }
    if (onOtherError) {
      return onOtherError(error);
    }
    throw error;
  }
}
