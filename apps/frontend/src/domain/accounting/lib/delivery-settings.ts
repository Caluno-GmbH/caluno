import { z } from 'zod';

/** Mirrors `BUNDLE_SUBJECT_PLACEHOLDERS` in the backend's bundle-email-subject.ts. */
export const BUNDLE_SUBJECT_PLACEHOLDERS = [
  'volunteer',
  'period',
  'type',
] as const;

const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g;

export function hasUnknownSubjectPlaceholder(subject: string): boolean {
  const known = new Set<string>(BUNDLE_SUBJECT_PLACEHOLDERS);
  return [...subject.matchAll(PLACEHOLDER_PATTERN)].some(
    (match) => !known.has(match[1] ?? ''),
  );
}

/** "accounting@example.org" -> "ac•••@example.org" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length - 1))}•••${email.slice(at)}`;
}

export function isValidEmail(value: string): boolean {
  return z.email().safeParse(value).success;
}
