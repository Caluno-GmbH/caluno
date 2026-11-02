#!/usr/bin/env bun
import { join } from 'node:path';
import {
  isDeniedOssPath,
  STATIC_DENIED_DIRS,
  staticDeniedPathPrefixes,
} from './denylist.ts';
import { findDeniedDirs } from './find-denied-dirs.ts';

const root = join(import.meta.dir, '../..');
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'list': {
    for (const dir of STATIC_DENIED_DIRS) console.log(dir);
    break;
  }
  case 'prefixes': {
    for (const prefix of staticDeniedPathPrefixes()) console.log(prefix);
    break;
  }
  case 'find': {
    for (const rel of findDeniedDirs(root)) console.log(`${rel}/`);
    break;
  }
  case 'check': {
    if (args.length === 0) {
      console.error('usage: check <repo-relative-path>...');
      process.exit(2);
    }
    const denied = args.filter(isDeniedOssPath);
    if (denied.length > 0) {
      console.error('denylisted paths:');
      for (const p of denied) console.error(`  ${p}`);
      process.exit(1);
    }
    break;
  }
  case 'clone': {
    const { $ } = await import('bun');
    const script = join(import.meta.dir, 'clone-filter.ts');
    const result = await $`bun run ${script} ${args}`.nothrow();
    process.exit(result.exitCode ?? 0);
    break;
  }
  default: {
    console.error(
      `usage: bun run scripts/oss-mirror/cli.ts <list|prefixes|find|check|clone>`,
    );
    process.exit(2);
  }
}
