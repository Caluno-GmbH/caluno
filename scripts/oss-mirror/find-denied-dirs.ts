import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  isEeDirName,
  normalizeRepoPath,
  STATIC_DENIED_DIRS,
} from './denylist.ts';

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.turbo',
  'dist',
  '.next',
]);

export function findDeniedDirs(root: string): string[] {
  const found: string[] = [];
  const staticExact = new Set(
    STATIC_DENIED_DIRS.map((d) => normalizeRepoPath(d)).filter(Boolean),
  );

  function walk(absDir: string) {
    try {
      const entries = readdirSync(absDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SKIP_DIR_NAMES.has(entry.name)) continue;

        const abs = join(absDir, entry.name);
        const rel = relative(root, abs).replace(/\\/g, '/');

        if (isEeDirName(entry.name) || staticExact.has(rel)) {
          found.push(rel);
          continue;
        }

        walk(abs);
      }
    } catch {
      return;
    }
  }

  walk(root);

  return found.sort(
    (a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a),
  );
}

export function assertDir(path: string): void {
  if (!statSync(path).isDirectory()) {
    throw new Error(`not a directory: ${path}`);
  }
}
