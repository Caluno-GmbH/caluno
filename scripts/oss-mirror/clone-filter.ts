#!/usr/bin/env bun
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { $ } from 'bun';
import { findDeniedDirs } from './find-denied-dirs';

const ENV_FILES = ['.env', 'apps/frontend/.env', 'apps/backend/.env'] as const;

function usage(): never {
  console.error(
    `usage: bun run scripts/oss-mirror/clone-filter.ts [--ref <ref>] [--out <dir>] [--source <url|path>] [--dry-run]`,
  );
  process.exit(2);
}

function parseArgs(argv: string[]) {
  let source: string | undefined;
  let ref: string | undefined;
  let out: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage();
    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (a === '--source' || a === '--ref' || a === '--out') {
      const v = argv[++i];
      if (!v) usage();
      if (a === '--source') source = v;
      else if (a === '--ref') ref = v;
      else out = v;
      continue;
    }
    usage();
  }
  return { source, ref, out, dryRun };
}

/** Remove all entries inside `dir`, leaving `dir` itself. */
function emptyDir(dir: string) {
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}

const repoRoot = resolve(import.meta.dir, '../..');
const args = parseArgs(process.argv.slice(2));
const source = args.source ?? repoRoot;
const out =
  args.out ??
  join(
    tmpdir(),
    `caluno-oss-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
const outAbs = resolve(out);

if (existsSync(outAbs)) {
  console.log(`emptying existing output: ${outAbs}`);
  emptyDir(outAbs);
} else {
  mkdirSync(outAbs, { recursive: true });
}
console.log(`cloning ${source} → ${outAbs}`);
const isRemote = /^(https?:|git@|ssh:)/.test(source);
const result = isRemote
  ? await $`git clone ${source} ${outAbs}`.nothrow()
  : await $`git clone --local ${source} ${outAbs}`.nothrow();
if (result.exitCode !== 0) {
  console.error(result.stderr.toString());
  process.exit(result.exitCode ?? 1);
}

if (args.ref) {
  const co = await $`git -C ${outAbs} checkout ${args.ref}`.nothrow();
  if (co.exitCode !== 0) {
    console.error(co.stderr.toString());
    process.exit(co.exitCode ?? 1);
  }
}

const { dryRun } = args;
const denied = findDeniedDirs(outAbs);
if (denied.length === 0) {
  console.log('no denied directories found — tree already OSS-clean');
} else {
  console.log(
    `${dryRun ? 'would remove' : 'removing'} ${denied.length} director${denied.length === 1 ? 'y' : 'ies'}:`,
  );
  for (const rel of denied) {
    console.log(`  ${rel}/`);
    if (!dryRun) rmSync(join(outAbs, rel), { recursive: true, force: true });
  }
}

const envSrcRoot = isRemote ? repoRoot : resolve(source);
for (const rel of ENV_FILES) {
  const from = join(envSrcRoot, rel);
  const to = join(outAbs, rel);
  if (!existsSync(from)) {
    console.log(`skip missing env: ${rel}`);
    continue;
  }
  if (!dryRun) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  console.log(`${dryRun ? 'would copy' : 'copied'} ${rel}`);
}

await $`git -C ${outAbs} remote remove origin`.nothrow();
console.log(`\nOSS tree ready at: ${outAbs}`);
if (dryRun) console.log('(dry-run: nothing deleted)');
