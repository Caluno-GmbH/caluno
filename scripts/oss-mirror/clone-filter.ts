#!/usr/bin/env bun
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { $ } from 'bun';
import { findDeniedDirs } from './find-denied-dirs.ts';

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
  console.error(`output already exists: ${outAbs}`);
  process.exit(1);
}

mkdirSync(resolve(outAbs, '..'), { recursive: true });
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

await $`git -C ${outAbs} remote remove origin`.nothrow();
console.log(`\nOSS tree ready at: ${outAbs}`);
if (dryRun) console.log('(dry-run: nothing deleted)');
