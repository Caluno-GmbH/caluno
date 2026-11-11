import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Type } from '@nestjs/common';

/**
 * Load EE Nest modules when `src/ee` exists (private / hosted builds).
 * OSS trees without `ee/` get an empty list — core app still boots.
 */
export function loadEeModules(): Type<unknown>[] {
  const base = join(__dirname, '..', 'ee');
  const candidates = [join(base, 'ee.module.ts'), join(base, 'ee.module.js')];
  if (!candidates.some((path) => existsSync(path))) {
    return [];
  }

  // Dynamic require so TypeScript/OSS builds do not hard-depend on ee/.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../ee/ee.module') as { EeModule: Type<unknown> };
  return [mod.EeModule];
}
