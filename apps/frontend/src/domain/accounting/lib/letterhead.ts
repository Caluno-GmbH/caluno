import type { DataSourceKey } from '@repo/data';

const nonBlank = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * The fixed letterhead block printed top-left above the document title: org
 * name, address, zip+city. Presentation rendered from resolved org values —
 * not template content, so coordinators can't edit or remove it (VOLI-1217).
 * Blank values are skipped line-wise.
 */
export const letterheadLines = (
  values: Partial<Record<DataSourceKey, string>>,
): string[] => {
  const zipCity = [nonBlank(values.org_zip), nonBlank(values.org_city)]
    .filter((part) => part !== undefined)
    .join(' ');
  return [
    nonBlank(values.org_name),
    nonBlank(values.org_street),
    zipCity || undefined,
  ].filter((line): line is string => line !== undefined);
};
