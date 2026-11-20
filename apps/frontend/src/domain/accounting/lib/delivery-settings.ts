import {
  BUNDLE_SUBJECT_PLACEHOLDERS,
  MAX_BUNDLE_SUBJECT_LENGTH,
  unknownSubjectPlaceholders,
} from '@repo/bundle-email';
import { z } from 'zod';

export { BUNDLE_SUBJECT_PLACEHOLDERS, MAX_BUNDLE_SUBJECT_LENGTH };

export function hasUnknownSubjectPlaceholder(subject: string): boolean {
  return unknownSubjectPlaceholders(subject).length > 0;
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
