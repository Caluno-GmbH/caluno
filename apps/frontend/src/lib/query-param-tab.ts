/**
 * Pure helpers for syncing a tab (or similar enum) to a URL search param.
 * Prefer `useQueryParamTab` in client components.
 */

export function parseQueryParamValue<T extends string>(
  raw: string | null | undefined,
  values: readonly T[],
  defaultValue: T,
): T {
  return raw != null && (values as readonly string[]).includes(raw)
    ? (raw as T)
    : defaultValue;
}

/** Returns the next query string (no leading `?`). Empty when no params remain. */
export function applyQueryParamValue(
  search: string,
  param: string,
  value: string,
  options?: { omitWhen?: string },
): string {
  const params = new URLSearchParams(search);
  if (options?.omitWhen !== undefined && value === options.omitWhen) {
    params.delete(param);
  } else {
    params.set(param, value);
  }
  return params.toString();
}

export function hrefWithSearch(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}
