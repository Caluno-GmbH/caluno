import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBackendRoot } from '../legal/backend-root';
import { TermsChangeClass as TermsClass } from './enums';

export const TERMS_FILENAME_PATTERN =
  /^terms_(\d+\.\d+)_(\d{4}-\d{2}-\d{2})_(en|de)\.pdf$/;

export type TermsLocale = 'en' | 'de';

export type TermsVersion = {
  version: string;
  major: number;
  minor: number;
  date: string;
  locale: TermsLocale;
  filename: string;
  path: string;
};

export function isTermsLocale(value: string): value is TermsLocale {
  return value === 'en' || value === 'de';
}

export function parseTermsFilename(
  filename: string,
): Omit<TermsVersion, 'path'> | null {
  const match = filename.match(TERMS_FILENAME_PATTERN);
  if (!match) {
    return null;
  }

  const [, version, date, locale] = match;
  const [major, minor] = version.split('.').map(Number);

  return {
    version,
    major,
    minor,
    date,
    locale: locale as TermsLocale,
    filename,
  };
}

export function termsChangeClassForVersion(version: string): TermsClass {
  const minor = Number(version.split('.')[1]);
  return minor === 0 ? TermsClass.MAJOR : TermsClass.MINOR;
}

export function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

export function listTermsDocuments(directory: string): TermsVersion[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => parseTermsFilename(entry.name))
    .filter((parsed): parsed is Omit<TermsVersion, 'path'> => parsed !== null)
    .map((parsed) => ({ ...parsed, path: join(directory, parsed.filename) }));
}

export function pickCurrentTermsVersion(
  docs: TermsVersion[],
): TermsVersion | undefined {
  return [...docs]
    .sort((a, b) => {
      const byVersion = compareVersions(a.version, b.version);
      if (byVersion !== 0) {
        return byVersion;
      }
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) {
        return byDate;
      }
      return a.locale.localeCompare(b.locale);
    })
    .at(-1);
}

export function defaultTermsDirectory(): string {
  return join(getBackendRoot(), 'legal');
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export const TERMS_PLACEHOLDER_MARKER = '%CALUNO-TERMS-PLACEHOLDER%';

export function isTermsPlaceholderDocument(path: string): boolean {
  return readFileSync(path).includes(TERMS_PLACEHOLDER_MARKER);
}
