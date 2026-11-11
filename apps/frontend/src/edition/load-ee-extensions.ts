import type { EeExtensions } from './enterprise-extensions';
import { hasEeEdition } from './has-ee-edition';

let cached: Promise<EeExtensions | null> | null = null;

/**
 * Loads the single EE extensions manifest (`@/ee`) when `hasEeEdition()`
 * (presence of `src/ee`); OSS mirrors have no `src/ee`, so this resolves to
 * `null` and the import never runs. One generic loader instead of a bespoke
 * `hasEeEdition()` + dynamic import per feature.
 *
 * `turbopackOptional` keeps the module in the Turbopack graph when present
 * (so `'use client'` slots stay Client References) while suppressing resolve
 * errors on OSS checkouts where `src/ee` is stripped. Do not use
 * `webpackIgnore`/`turbopackIgnore` here — those skip compilation and break
 * hooks when an RSC renders a slot component.
 */
export function loadEeExtensions(): Promise<EeExtensions | null> {
  if (!hasEeEdition()) {
    return Promise.resolve(null);
  }
  cached ??= import(/* turbopackOptional: true */ '@/ee').then(
    (mod) => mod.eeExtensions,
  );
  return cached;
}
