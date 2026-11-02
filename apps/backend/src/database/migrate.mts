#!/usr/bin/env bun
/**
 * Apply OSS migrations, then EE migrations when `src/ee` is present.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

const backendRoot = join(import.meta.dir, '../..');
const eeConfig = join(backendRoot, 'src/ee/drizzle.config.ts');
const eeDir = join(backendRoot, 'src/ee');

const oss =
  await $`bunx drizzle-kit migrate --config=${join(backendRoot, 'drizzle.config.ts')}`
    .cwd(backendRoot)
    .nothrow();
if (oss.exitCode !== 0) {
  process.exit(oss.exitCode ?? 1);
}

if (existsSync(eeDir) && existsSync(eeConfig)) {
  console.log('Applying EE migrations…');
  const ee = await $`bunx drizzle-kit migrate --config=${eeConfig}`
    .cwd(backendRoot)
    .nothrow();
  if (ee.exitCode !== 0) {
    process.exit(ee.exitCode ?? 1);
  }
} else {
  console.log('Skipping EE migrations (src/ee not present).');
}
