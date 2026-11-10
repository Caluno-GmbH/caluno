/**
 * Ambient types for the optional EE manifest (`@/ee` → `src/ee`).
 * Private checkouts have the real module; OSS mirrors strip `src/ee`.
 * This declaration keeps `import('@/ee')` / `import('@/ee/nav')`
 * typecheckable when absent. When `src/ee` exists, keep the public
 * exports aligned with these shapes.
 */
declare module '@/ee' {
  import type { EeExtensions } from './enterprise-extensions';
  export const eeExtensions: EeExtensions;
}

declare module '@/ee/nav' {
  import type { EeExtensions } from './enterprise-extensions';
  export const eeNav: NonNullable<EeExtensions['nav']>;
}
