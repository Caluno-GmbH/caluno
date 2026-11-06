#!/usr/bin/env bun
/**
 * Copy the current git-tracked tree into an existing target directory,
 * stripping EE / denylisted paths. Preserves target `.git`.
 *
 * Syncs tracked files only — no ignored/untracked files, no source `.git`.
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { $ } from 'bun';
import { isDeniedOssPath, normalizeRepoPath } from './denylisting';

const MODE_SYMLINK = '120000';
const MODE_GITLINK = '160000';

function usage(): never {
  console.error(
    `usage: bun run scripts/ee-oss-mirror/oss-copy.ts <target-dir>`,
  );
  process.exit(2);
}

/** Remove all entries inside `dir` except `.git`. */
function emptyDirKeepGit(dir: string) {
  for (const name of readdirSync(dir)) {
    if (name === '.git') continue;
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

type TrackedEntry = { mode: string; path: string };

/** List staged/tracked entries (`mode path`) under a git work tree. */
async function listTracked(workTree: string): Promise<TrackedEntry[]> {
  const ls = await $`git -C ${workTree} ls-files -z --stage`.quiet().nothrow();
  if (ls.exitCode !== 0) {
    console.error(ls.stderr.toString() || `git ls-files failed in ${workTree}`);
    process.exit(ls.exitCode ?? 1);
  }
  const out: TrackedEntry[] = [];
  for (const record of ls.stdout.toString().split('\0').filter(Boolean)) {
    // stage line: <mode> <sha> <stage>\t<path>
    const tab = record.indexOf('\t');
    if (tab < 0) continue;
    const meta = record.slice(0, tab);
    const path = record.slice(tab + 1);
    const mode = meta.split(' ', 1)[0];
    if (!mode || !path) continue;
    out.push({ mode, path });
  }
  return out;
}

function ensureParent(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function copyRegularFile(from: string, to: string) {
  ensureParent(to);
  copyFileSync(from, to);
}

function copySymlink(from: string, to: string) {
  ensureParent(to);
  symlinkSync(readlinkSync(from), to);
}

/**
 * Copy one git work tree's tracked entries into `targetRoot`, prefixing
 * destination paths with `pathPrefix` (empty for the main repo).
 * Skips denylisted paths (checked against the full repo-relative path).
 */
async function copyTrackedTree(opts: {
  sourceRoot: string;
  targetRoot: string;
  pathPrefix: string;
}): Promise<{ copied: number; skipped: number }> {
  const { sourceRoot, targetRoot, pathPrefix } = opts;
  let copied = 0;
  let skipped = 0;

  for (const { mode, path: rel } of await listTracked(sourceRoot)) {
    const repoRel = normalizeRepoPath(
      pathPrefix ? `${pathPrefix}/${rel}` : rel,
    );
    if (isDeniedOssPath(repoRel)) {
      skipped++;
      continue;
    }

    const from = join(sourceRoot, rel);
    const to = join(targetRoot, repoRel);

    if (mode === MODE_GITLINK) {
      if (!existsSync(from) || !statSync(from).isDirectory()) {
        console.warn(`skip unchecked-out submodule: ${repoRel}`);
        skipped++;
        continue;
      }
      mkdirSync(to, { recursive: true });
      const nested = await copyTrackedTree({
        sourceRoot: from,
        targetRoot,
        pathPrefix: repoRel,
      });
      copied += nested.copied;
      skipped += nested.skipped;
      continue;
    }

    if (!existsSync(from)) {
      console.warn(`skip missing: ${repoRel}`);
      skipped++;
      continue;
    }

    if (mode === MODE_SYMLINK || lstatSync(from).isSymbolicLink()) {
      copySymlink(from, to);
      copied++;
      continue;
    }

    copyRegularFile(from, to);
    copied++;
  }

  return { copied, skipped };
}

const targetArg = process.argv[2];
if (!targetArg || targetArg === '-h' || targetArg === '--help') usage();
if (process.argv.length > 3) usage();

const repoRoot = resolve(import.meta.dir, '../..');
const targetAbs = resolve(targetArg);

if (!existsSync(targetAbs)) {
  console.error(`target directory does not exist: ${targetAbs}`);
  process.exit(1);
}
if (!statSync(targetAbs).isDirectory()) {
  console.error(`not a directory: ${targetAbs}`);
  process.exit(1);
}

console.log(`clearing ${targetAbs} (keeping .git)`);
emptyDirKeepGit(targetAbs);

const { copied, skipped } = await copyTrackedTree({
  sourceRoot: repoRoot,
  targetRoot: targetAbs,
  pathPrefix: '',
});

const UNTRACKED_FILES_TO_COPY = [
  '.env',
  'apps/frontend/.env',
  'apps/backend/.env',
] as const;
for (const rel of UNTRACKED_FILES_TO_COPY) {
  const from = join(repoRoot, rel);
  const to = join(targetAbs, rel);
  if (!existsSync(from)) {
    console.log(`skip missing: ${rel}`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${rel}`);
}

console.log(
  `copied ${copied} tracked file${copied === 1 ? '' : 's'}, skipped ${skipped} denied/missing`,
);
console.log(`OSS tree ready at: ${targetAbs}`);
