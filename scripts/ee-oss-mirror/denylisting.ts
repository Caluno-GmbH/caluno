/**
 * OSS mirror denylist — paths that must never leave the private monorepo.
 *
 * EE dirs: any directory named `ee` or `ee-*` anywhere in the tree.
 * Static denials: repo-relative paths from sibling file `denylist`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function isEeDirName(dirName: string): boolean {
  return dirName === 'ee' || dirName.startsWith('ee-');
}

export const DENYLIST_FILE = join(import.meta.dir, 'denylist');

export function normalizeRepoPath(repoRelativePath: string): string {
  return repoRelativePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
}

export function parseDenylistText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const path = normalizeRepoPath(line);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}

export function loadStaticDeniedDirs(
  filePath: string = DENYLIST_FILE,
): string[] {
  return parseDenylistText(readFileSync(filePath, 'utf8'));
}

export const STATIC_DENIED_DIRS: readonly string[] = loadStaticDeniedDirs();

export function isUnderStaticDeniedDir(
  repoRelativePath: string,
  deniedDirs: readonly string[] = STATIC_DENIED_DIRS,
): boolean {
  const normalized = normalizeRepoPath(repoRelativePath);
  if (!normalized) return false;
  return deniedDirs.some((dir) => {
    const d = normalizeRepoPath(dir);
    return normalized === d || normalized.startsWith(`${d}/`);
  });
}

export function isDeniedOssPath(repoRelativePath: string): boolean {
  const normalized = normalizeRepoPath(repoRelativePath);
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some(isEeDirName)) return true;
  return isUnderStaticDeniedDir(normalized);
}
