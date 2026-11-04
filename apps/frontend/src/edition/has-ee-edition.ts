import { existsSync } from 'node:fs';
import path from 'node:path';

let cached: boolean | undefined;

/**
 * True when the EE tree is present (`src/ee`). The OSS mirror strips any
 * directory named `ee`, so this is false there without an env flag.
 * Set `CALUNO_EDITION=oss` to force OSS mode from a private checkout.
 */
export function hasEeEdition(): boolean {
  if (cached !== undefined) {
    return cached;
  }
  if (process.env.CALUNO_EDITION === 'oss') {
    cached = false;
    return cached;
  }
  cached = existsSync(path.join(process.cwd(), 'src', 'ee'));
  return cached;
}
