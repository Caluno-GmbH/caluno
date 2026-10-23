'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  applyQueryParamValue,
  hrefWithSearch,
  parseQueryParamValue,
} from '@/lib/query-param-tab';

interface UseQueryParamTabOptions<T extends string> {
  /** Allowed values; anything else falls back to `defaultValue`. */
  values: readonly T[];
  defaultValue: T;
  /** Search param name. Defaults to `tab`. */
  param?: string;
  /**
   * When true, selecting `defaultValue` removes the param so the default URL
   * stays clean (e.g. forms list without `?tab=forms`).
   */
  omitDefault?: boolean;
}

/**
 * Syncs a tab (or similar enum) to a URL search param via `router.replace`,
 * so refresh / back / sheet close restore the same tab.
 */
export function useQueryParamTab<T extends string>({
  values,
  defaultValue,
  param = 'tab',
  omitDefault = false,
}: UseQueryParamTabOptions<T>): {
  value: T;
  onValueChange: (value: string) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = parseQueryParamValue(
    searchParams.get(param),
    values,
    defaultValue,
  );

  const onValueChange = useCallback(
    (next: string) => {
      if (!(values as readonly string[]).includes(next)) return;
      const qs = applyQueryParamValue(
        searchParams.toString(),
        param,
        next,
        omitDefault ? { omitWhen: defaultValue } : undefined,
      );
      router.replace(hrefWithSearch(pathname, qs));
    },
    [values, searchParams, param, omitDefault, defaultValue, router, pathname],
  );

  return { value, onValueChange };
}
