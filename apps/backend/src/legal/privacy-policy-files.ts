import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getBackendRoot } from './backend-root';

export const PRIVACY_POLICY_FILENAME_PATTERN =
  /^privacy-policy_(\d{4}-\d{2}-\d{2})_(en|de)\.pdf$/;

export type PrivacyPolicyLocale = 'en' | 'de';

export type PrivacyPolicyDocument = {
  version: string;
  locale: PrivacyPolicyLocale;
  filename: string;
  path: string;
};

export function isPrivacyPolicyLocale(
  value: string,
): value is PrivacyPolicyLocale {
  return value === 'en' || value === 'de';
}

export function latestPrivacyPolicyVersionFromFilenames(
  filenames: string[],
): string {
  const versions = [
    ...new Set(
      filenames
        .map((filename) => filename.match(PRIVACY_POLICY_FILENAME_PATTERN)?.[1])
        .filter((version): version is string => version != null),
    ),
  ].sort();

  const latest = versions.at(-1);
  if (!latest) {
    throw new Error('No privacy policy PDF found');
  }

  return latest;
}

function listPrivacyPolicyFilenames(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

export function currentPrivacyPolicyVersion(directory: string): string {
  return latestPrivacyPolicyVersionFromFilenames(
    listPrivacyPolicyFilenames(directory),
  );
}

export function resolvePrivacyPolicyDocument(
  directory: string,
  locale: PrivacyPolicyLocale,
): PrivacyPolicyDocument {
  const filenames = listPrivacyPolicyFilenames(directory);
  const version = latestPrivacyPolicyVersionFromFilenames(filenames);
  const filename = `privacy-policy_${version}_${locale}.pdf`;

  if (!filenames.includes(filename)) {
    throw new Error(`No privacy policy PDF found for locale ${locale}`);
  }

  return {
    version,
    locale,
    filename,
    path: join(directory, filename),
  };
}

export function defaultPrivacyPolicyDirectory(): string {
  return join(getBackendRoot(), 'legal');
}
