import { parseQueryParamValue } from '@/lib/query-param-tab';

export const DISCOVER_TABS = ['assignments', 'events'] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number];

export function parseDiscoverTab(
  value: string | null | undefined,
): DiscoverTab {
  return parseQueryParamValue(value, DISCOVER_TABS, 'assignments');
}
