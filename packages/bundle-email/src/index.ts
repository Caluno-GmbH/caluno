/** Placeholders a bundle email subject may use. */
export const BUNDLE_SUBJECT_PLACEHOLDERS = [
  'volunteer',
  'period',
  'type',
] as const;

export type BundleSubjectPlaceholder =
  (typeof BUNDLE_SUBJECT_PLACEHOLDERS)[number];

export const MAX_BUNDLE_SUBJECT_LENGTH = 200;

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;

/** Placeholder names in `subject` that are not in the known set. */
export function unknownSubjectPlaceholders(subject: string): string[] {
  const known = new Set<string>(BUNDLE_SUBJECT_PLACEHOLDERS);
  return [...subject.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1] ?? '')
    .filter((name) => !known.has(name));
}
