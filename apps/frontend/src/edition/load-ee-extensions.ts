import type { EeExtensions } from './ee-extensions';
import { hasEeEdition } from './has-ee-edition';

let cached: Promise<EeExtensions | null> | null = null;

/**
 * Loads the single EE extensions manifest (`@/ee`) when the edition flag is
 * set; OSS mirrors have no `src/ee`, so this resolves to `null` and the
 * import never runs. One generic loader instead of a bespoke
 * `hasEeEdition()` + `webpackIgnore` dynamic import per feature.
 */
export function loadEeExtensions(): Promise<EeExtensions | null> {
  if (!hasEeEdition()) {
    return Promise.resolve(null);
  }
  cached ??= import(/* webpackIgnore: true */ '@/ee').then(
    (mod) => (mod as { eeExtensions: EeExtensions }).eeExtensions,
  );
  return cached;
}
